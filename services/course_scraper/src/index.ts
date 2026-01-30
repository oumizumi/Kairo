import express, { Request, Response } from 'express';
import cors from 'cors';
import { uottawaScraper, UOttawaCourse } from './scrape_uottawa_courses';

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Middleware to parse JSON bodies (though not strictly needed for this GET route)

// Root route
app.get('/', (req: Request, res: Response) => {
  res.send('Kairo Scraper is running!');
});

// Scrape route
app.get('/api/scrape', async (req: Request, res: Response) => {
  const subject = req.query.subject as string;
  const term = req.query.term as string;

  if (!subject || !term) {
    res.status(400).json({ error: 'Missing required query parameters: subject and term' });
    return;
  }

  console.log(`Received request: /api/scrape?subject=${subject}&term=${term}`);

  try {
    const courses = await uottawaScraper.searchBySubject(subject, term);
    const result = {
      source: 'uottawa',
      data: courses,
      count: courses.length
    };

    console.log(`Found ${courses.length} courses for ${subject} in ${term}`);
    res.json(result);
  } catch (error: any) {
    console.error(`Error in /api/scrape for subject '${subject}', term '${term}':`, error);
    res.status(500).json({ error: 'Failed to scrape courses.', details: error.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Kairo Scraper server listening at http://localhost:${port}`);
});
