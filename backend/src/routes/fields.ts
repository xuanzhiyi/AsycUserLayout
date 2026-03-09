import express, { Request, Response } from 'express';
import { updateFieldValue, lockField, unlockField, getFieldLock } from '../database';
import { authMiddleware, AuthToken } from './auth';

const router = express.Router({ mergeParams: true });

router.use(authMiddleware);

// Update field value
router.post('/:fieldId/commit', async (req: Request, res: Response) => {
  try {
    const { fieldId, caseId } = req.params;
    const { value } = req.body;
    const user = (req as any).user as AuthToken;

    await updateFieldValue(fieldId, value, user.userId);

    res.json({ success: true, message: 'Field updated' });
  } catch (error) {
    console.error('Error updating field:', error);
    res.status(500).json({ success: false, message: 'Failed to update field' });
  }
});

// Get field lock status
router.get('/:fieldId/lock', async (req: Request, res: Response) => {
  try {
    const { fieldId } = req.params;
    const lock = await getFieldLock(fieldId);

    res.json({ success: true, data: lock });
  } catch (error) {
    console.error('Error fetching lock:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lock' });
  }
});

export default router;
