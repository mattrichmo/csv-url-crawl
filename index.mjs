import chalk from 'chalk';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import cheerio from 'cheerio';
import fs from 'fs';
import csvParser from 'csv-parser';
import { URL } from 'url'; // Import URL module to parse and compare URLs

let fileName = 'links.csv';

const loadCsvLinks = async (fileName) => {
    let linksToScrape = [];

    await new Promise((resolve, reject) => {
        fs.createReadStream(fileName)
            .pipe(csvParser({
                headers: false, // Indicate that the CSV has no headers
                skipLines: 0, // Skip no lines at the beginning
                trim: true // Trim whitespace from each field
            }))
            .on('data', (row) => {
                console.log(chalk.green('Processing row:'), row); // Log each row for debugging

                // Loop through all properties in the row object
                for (let key in row) {
                    let originalUrl = row[key];
                    if (!originalUrl) {
                        console.log(chalk.red('URL is undefined or empty in this column.'));
                        continue;
                    }

                    let formattedUrl = originalUrl.trim();
                    let neededParsing = false;

                    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
                        formattedUrl = 'http://' + formattedUrl;
                        neededParsing = true;
                    }

                    if (neededParsing) {
                        console.log(chalk.yellow('Parsing needed for:'), originalUrl);
                    } else {
                        console.log(chalk.blue('Clean format (no parsing needed):'), originalUrl);
                    }

                    linksToScrape.push(formattedUrl);
                }
            })
            .on('end', () => {
                console.log(chalk.green('CSV file successfully processed'));
                for (let i = 0; i < linksToScrape.length; i++) {
                    console.log(chalk.dim(`${i + 1}:`), linksToScrape[i]);
                }
                resolve();
            });
    });

    return linksToScrape;
};


const scrapeLink = async (link, depth = 1, parentDomain = null, visitedLinks = new Set()) => {
    // depth: The depth of the current link in the link tree
    // 1 = main link, 2 = child link, 3 = grandchild link, etc.
    const MAX_DEPTH = 1; // Adjust this as needed

    if (visitedLinks.has(link) || depth > MAX_DEPTH) {
        return;
    }

    visitedLinks.add(link);

    if (depth === 1) {
        parentDomain = new URL(link).hostname;
    }

    console.log(chalk.dim(`Scraping link:`),chalk.green(`${link}`, chalk.dim(`depth ${depth}:`)));

    let linkObject = {
        id: uuidv4(),
        url: link,
        linkPages: []
    };

    try {
        const response = await axios.get(link);
        const $ = cheerio.load(response.data);

        const cleanText = (text) => {
            if (!text) return ''; // Check if text is undefined or null
            // Remove common unwanted patterns and excessive whitespace
            return text.replace(/Chevron down icon/g, '') // Example pattern
                       .replace(/\n/g, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
        };

        linkObject.linkPages.push({
            pageId: uuidv4(),
            isChildPage: depth > 1,
            url: link,
            h1Text: $('h1').map((i, el) => cleanText($(el).text())).get(),
            h2Text: $('h2').map((i, el) => cleanText($(el).text())).get(),
            meta: {
                title: cleanText($('title').text()),
                description: cleanText($('meta[name="description"]').attr('content')),
                keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(keyword => cleanText(keyword))
            }
        });


        if (depth < MAX_DEPTH) {
            const childLinks = $('a').map((i, el) => $(el).attr('href')).get();
            for (let childLink of childLinks) {
                try {
                    let fullChildLink = childLink.startsWith('http') ? childLink : new URL(childLink, link).href;

                    if (new URL(fullChildLink).hostname === parentDomain && !visitedLinks.has(fullChildLink)) {
                        let childPageData = await scrapeLink(fullChildLink, depth + 1, parentDomain, visitedLinks);
                        if (childPageData) {
                            linkObject.linkPages.push(childPageData);
                        }
                    }
                } catch (error) {
                    console.error(chalk.red(`Error processing child link ${childLink}: `), error.message);
                }
            }
        }
    } catch (error) {
        console.error(chalk.red(`Error scraping ${link}: `), error.message);
    }

    return linkObject;
};

const scrapeAllLinks = async (linksToScrape) => {
    let scrapedData = [];
    for (let link of linksToScrape) {
        let linkObject = await scrapeLink(link);
        scrapedData.push(linkObject);
    }
    console.log(chalk.green('All links have been scraped.'));
    return scrapedData;
};

const removeDuplicates = array => [...new Set(array)];

const generateCsvData = (scrapedData) => {
    const parentLinkData = [];
    const childLinkData = [];
    const allLinkData = [];

    scrapedData.forEach(data => {
        data.linkPages.forEach(page => {
            // Fallback to empty arrays or strings if properties are undefined
            const uniqueH1Text = page.h1Text ? removeDuplicates(page.h1Text) : [];
            const uniqueH2Text = page.h2Text ? removeDuplicates(page.h2Text) : [];
            const uniqueKeywords = page.meta && page.meta.keywords ? removeDuplicates(page.meta.keywords) : [];

            const rowData = {
                url: page.url,
                title: page.meta && page.meta.title ? page.meta.title : '',
                description: page.meta && page.meta.description ? page.meta.description : '',
                keywords: uniqueKeywords.join(', '),
                h1Text: uniqueH1Text.join(', '),
                h2Text: uniqueH2Text.join(', ')
            };

            if (!page.isChildPage) {
                parentLinkData.push(rowData);
            } else {
                childLinkData.push(rowData);
            }

            allLinkData.push(rowData);
        });
    });

    return { parentLinkData, childLinkData, allLinkData };
};


const saveToCsv = (data, filename) => {
    const csvContent = [
        'URL,Page Titles,Meta Descriptions,Meta Keywords,H1 Titles,H2 Titles'
    ].concat(data.map(row => 
        `${row.url},${row.title},${row.description},${row.keywords},${row.h1Text},${row.h2Text}`
    ));



    fs.writeFileSync(filename, csvContent.join('\n'));
    console.log(`Saved File: ${filename}`);

};
export const main = async () => {
    console.log(chalk.green('Starting scraping process'));
    let linksToScrape = await loadCsvLinks(fileName);
    let scrapedData = await scrapeAllLinks(linksToScrape);
    console.log(chalk.green('Scraping process completed'));

    console.log(`Scraped data: ${JSON.stringify(scrapedData, null, 2)}`);

    const { parentLinkData, childLinkData, allLinkData } = generateCsvData(scrapedData);

    saveToCsv(parentLinkData, 'parentLinkData.csv');
    saveToCsv(childLinkData, 'childLinkData.csv');
    saveToCsv(allLinkData, 'AllLinkData.csv');
};

main();
