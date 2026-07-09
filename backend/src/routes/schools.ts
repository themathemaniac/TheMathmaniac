import { Request, Response, Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper to generate acronym from string (e.g. "St. Jude's High School" -> "SJHS")
function generateAcronym(name: string): string {
  return name
    .split(/[\s-]/) // Split by space or hyphen
    .map(word => {
      // Remove any non-alphabetic character and take the first character
      const cleaned = word.replace(/[^a-zA-Z]/g, '');
      return cleaned.length > 0 ? cleaned[0] : '';
    })
    .filter(Boolean)
    .join('')
    .toUpperCase();
}

router.get('/search', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = req.query.q as string;
    
    let schools = [];
    if (!query || query.trim() === '') {
      schools = await prisma.school.findMany({
        take: 50,
        orderBy: { name: 'asc' }
      });
    } else {
      const q = query.trim();
      const qLower = q.toLowerCase();
      const qUpper = q.toUpperCase();
      
      const allSchools = await prisma.school.findMany();
      
      schools = allSchools.filter(school => {
        // match name
        if (school.name.toLowerCase().includes(qLower)) return true;
        // match aliases
        if (school.aliases.some(alias => alias.toLowerCase().includes(qLower))) return true;
        // acronym match
        const acronym = generateAcronym(school.name);
        if (acronym.includes(qUpper)) return true;
        
        return false;
      });
      
      // Sort by exact acronym match or starts with, then by name
      schools.sort((a, b) => {
        const aAcronym = generateAcronym(a.name);
        const bAcronym = generateAcronym(b.name);
        
        if (aAcronym === qUpper && bAcronym !== qUpper) return -1;
        if (bAcronym === qUpper && aAcronym !== qUpper) return 1;
        
        if (a.name.toLowerCase().startsWith(qLower) && !b.name.toLowerCase().startsWith(qLower)) return -1;
        if (b.name.toLowerCase().startsWith(qLower) && !a.name.toLowerCase().startsWith(qLower)) return 1;
        
        return a.name.localeCompare(b.name);
      });
      
      // Take top 20
      schools = schools.slice(0, 20);
    }
    
    res.json(schools);
  } catch (error) {
    console.error('Error searching schools:', error);
    res.status(500).json({ error: 'Failed to search schools' });
  }
});

router.post('/', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role === 'STUDENT') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    const school = await prisma.school.create({
      data: {
        name: name.trim(),
        aliases: []
      }
    });
    
    res.status(201).json(school);
  } catch (error: any) {
    console.error('Error creating school:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'School with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create school' });
  }
});

export default router;
