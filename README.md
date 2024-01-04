CSV-URL-CRAWL

A node.js app to parse urls from a csv, then scrape each page - creating a new pobject for each page under each link, then recompiling that into a flattened csv data export for each link. 

Primary purpose of this script for an upwork client. 

#Important Variables```
fileName = `linklist.csv` // set this to your csv file name
Max_Depth = 1
// This should be set to how deep you want to scrape each. 1 being only the main page

```

to run 

```
npm init```

THEN 

```
node index.mjs```