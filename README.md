CSV-URL-CRAWL

A node.js app to parse urls from a csv, then scrape each page - creating a new pobject for each page under each link, then recompiling that into a flattened csv data export for each link. 

Primary purpose of this code was built to a client's specifications in an Upwork Prjoect. 


#Important Variables
```
fileName = `links.csv` // set this to your csv file name

Max_Depth = 1  // This should be set to how deep you want to scrape each. 1 being only the main page

```

To Run
```
npm init

```

THEN 

```
node index.mjs
```

saves 3 files for now. 

allLinksData.csv: A concatentation of all page data scraped into 1 link object
parentLinkData.csv: just the parents data
chiildLinksData.csv: Just the child data

© 2024 all rights reserved Matt Richmond 