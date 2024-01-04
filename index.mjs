import axios from 'axios';
import cheerio from 'cheerio';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import csvParser from 'csv-parser';

const csvFilePath = 'links.csv'; // Replace with the path to your CSV file
const maxDepth = 3; // Maximum depth to follow links (adjust as needed)

const linkObject = {
    linkUUID: '',
    scrapeDate: '',
    linkURL: '',
    pages: [],
    linkStatus: '',
    linkError: '',
    linkRedirect: '',
    linkRedirectCount: 0, // Initialize redirect count to 0
    linkRedirectChain: [],
};

const scrapePage = async (url, depth) => {
    if (depth > maxDepth) {
        return; // Stop if reached maximum depth
    }

    try {
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Update link status
        linkObject.linkStatus = response.status;
        linkObject.linkRedirect = response.request.res.responseUrl; // Updated URL after redirects

        // Check for redirects
        if (response.request.res.responseUrl !== url) {
            linkObject.linkRedirectCount++;
            linkObject.linkRedirectChain.push(response.request.res.responseUrl);
        }

        const pageTitleText = $('title').text();
        const h1Text = $('h1').map((i, el) => $(el).text()).get();
        const h2Text = $('h2').map((i, el) => $(el).text()).get();
        const metaDescription = $('meta[name="description"]').attr('content');
        const metaKeywords = $('meta[name="keywords"]').attr('content')?.split(',');

        const pageObject = {
            pageUUID: uuidv4(),
            childPage: depth > 0, // Mark as child page if depth is greater than 0
            pageURL: url,
            pageTitleText: pageTitleText,
            h1Text: h1Text,
            h2Text: h2Text,
            pageMeta: [{
                metaDescription: metaDescription || '',
                metaKeywords: metaKeywords || [],
            }]
        };

        linkObject.pages.push(pageObject);
        console.log(`Page: ${url}`);
        console.dir(pageObject, { depth: null });

        // Find and scrape links on the current page
        const links = $('a[href]');
        for (let i = 0; i < links.length; i++) {
            const link = $(links[i]).attr('href');
            if (link) {
                const absoluteLink = new URL(link, url).href;
                await scrapePage(absoluteLink, depth + 1);
            }
        }
    } catch (error) {
        console.error(`Error scraping ${url}:`, error.message);
        // Update link error
        linkObject.linkError = error.message;
    }
};

const main = async () => {
    linkObject.linkUUID = uuidv4();
    linkObject.scrapeDate = new Date().toISOString();

    fs.createReadStream(csvFilePath)
        .pipe(csvParser())
        .on('data', (row) => {
            // Assuming the CSV has a 'link' column containing the URLs
            const link = row.link;
            scrapePage(link, 0);
        })
        .on('end', () => {
            console.log('Link Object:');
            console.dir(linkObject, { depth: null });
        });
};

main();
