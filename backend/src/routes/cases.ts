import express, { Request, Response } from 'express';
import { getAllCases, getCaseWithFields } from '../database';
import { authMiddleware } from './auth';
import { Case, CaseListItem } from '../../../shared/types';

const router = express.Router();

// Store active editors in memory (in production, use Redis or similar)
const activeCaseEditors: Map<string, Set<string>> = new Map();

router.use(authMiddleware);

// Get list of all cases with active editors
router.get('/', async (req: Request, res: Response) => {
  try {
    const cases = await getAllCases();
    const casesList: CaseListItem[] = cases.map((caseItem) => ({
      id: caseItem.id,
      title: caseItem.title,
      description: caseItem.description,
      status: caseItem.status,
      activeEditors: Array.from(activeCaseEditors.get(caseItem.id) || []),
    }));

    res.json({ success: true, data: casesList });
  } catch (error) {
    console.error('Error fetching cases:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch cases' });
  }
});

// Get single case with all fields
router.get('/:caseId', async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const caseData = await getCaseWithFields(caseId);

    if (!caseData) {
      return res.status(404).json({ success: false, message: 'Case not found' });
    }

    const formattedCase: Case = {
      id: caseData.id,
      title: caseData.title,
      description: caseData.description,
      status: caseData.status,
      createdAt: caseData.created_at,
      fields: caseData.fields.map((field) => ({
        id: field.id,
        caseId: field.case_id,
        fieldName: field.field_name,
        fieldType: field.field_type as any,
        value: field.value === '' || field.value === null ? '' : field.value,
        lockedByUserId: field.locked_by_user_id,
        lockedAt: field.locked_at,
      })),
    };

    res.json({ success: true, data: formattedCase });
  } catch (error) {
    console.error('Error fetching case:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch case' });
  }
});

// Track active editors (called by Socket.IO)
export function addActiveEditor(caseId: string, username: string) {
  if (!activeCaseEditors.has(caseId)) {
    activeCaseEditors.set(caseId, new Set());
  }
  activeCaseEditors.get(caseId)!.add(username);
}

export function removeActiveEditor(caseId: string, username: string) {
  const editors = activeCaseEditors.get(caseId);
  if (editors) {
    editors.delete(username);
    if (editors.size === 0) {
      activeCaseEditors.delete(caseId);
    }
  }
}

export function getActiveEditors(caseId: string): string[] {
  return Array.from(activeCaseEditors.get(caseId) || []);
}

export default router;
