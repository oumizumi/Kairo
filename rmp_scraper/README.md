# Rate My Professor Review Scraper

## What is This?
This is code that scrapes rate my professor for reviews of specific professors, along with the Average Difficulty, the tags of the reviews, and the Overall Rating.

This project was built for collecting data in order to train a Natural Language Processing model that can read reviews and predict the tags of each review. 

This was built because I could not find any Rate My Professor Scraper that still worked.

It uses Puppeteer to scrape information off of rate my professor to collect the Professor ID in order to use RateMyProfessors' GraphQL API to retrieve a JSON and add that data into a CSV that is easy to access.

## [IMPORTANT] READ BEFORE

The Code does not work out of the box and requires work before running. The following instructions will guide you through the setup and using it.

Pre-Requirements: 

 - A CSV pre-filled with the names of the professors whose reviews you want to scrape in the code directory
 - Node.js
 - Python

Known Issues: 

 - The CSV must have professors that are all from the same University. 
 - If there are two professors with the same name, then the professor whose name appears first in search is the only one that works.
 
 
 

# Instructions To Setup And Run

Once you have downloaded the code, there is some extra setup.

**First,** open up terminal in the same directory as the code install the node modules.
```npm i```

**Next,** open run.js, and at the end enter your university name where it says "UNIVERSITY NAME HERE". 
    *Note: It has to be the way it appears at RMP*

**Then** change where it says ./name.csv to the path of your csv.

*Note: This should only have one column 'Name' with the first and last name of your professor, this is what will be searched up in your puppeteer browser*

**Start** scraping by running the command in the directory:
```node run.js```

**After** the csv has been run the csv should have been modified to have a list of numbers next to each professors name.

**Now**, open up "pdcsv.py", install the dependencies using pip and make sure the "./name.csv" is the path to your modified csv. Run the python file and it should create a new csv called 'b64.csv'.

Once you have b64.csv open up main.py and install the dependencies and run it

## Now it should be done!
Now you have a csv filled with the reviews of professors and the data on that review and the professors!



