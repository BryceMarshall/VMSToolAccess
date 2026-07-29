import { Router } from 'express';
import { Response as ApiResponse } from '../data';
import * as data from '../data';
import { requireAuth, audit } from '../middleware/auth';
import {
  GYMMASTER_API_KEY,
  GYMMASTER_BASE_URL,
  TRAINING_TOOL_ID,
  TRAINING_LABEL_ID,
} from '../config';

// Shape of a member record from GymMaster's /member endpoint. We only pick the
// fields we use; the payload has many more.
interface GymMasterMember {
  id: number;
  fullname: string;
  email: string;
  phonecell: string;
}

// Fetch all members carrying the given label. type=2 + labelids selects the
// tagged population; limit is generous for a single tool's authorized list.
async function fetchTaggedMembers(labelId: number): Promise<GymMasterMember[]> {
  const url =
    `${GYMMASTER_BASE_URL}/member/?type=2&sort=U%2B&page=1&limit=200&labelids=${labelId}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'X-GM-API-KEY': GYMMASTER_API_KEY,
    },
  });

  if (!resp.ok) {
    throw new Error(`GymMaster API returned ${resp.status}`);
  }

  const body = await resp.json();

  // GymMaster v3 wraps results; be defensive about the exact envelope. Accept
  // either a bare array or a { data: [...] } / { result: [...] } wrapper.
  const arr: any[] = Array.isArray(body)
    ? body
    : Array.isArray(body?.data)
      ? body.data
      : Array.isArray(body?.result)
        ? body.result
        : [];

  return arr as GymMasterMember[];
}

export function createTrainingRouter(sendUpdate: () => void): Router {
  const router = Router();

  // Manually trigger an authoritative sync of the trial tool's access list.
  router.post('/sync', requireAuth, async (req, res) => {
    console.log('api/training/sync called');

    if (!GYMMASTER_API_KEY) {
      res.status(500).json(ApiResponse.mkErr('GymMaster API key not configured'));
      return;
    }

    let members: GymMasterMember[];
    try {
      members = await fetchTaggedMembers(TRAINING_LABEL_ID);
    } catch (e: any) {
      console.log('Error fetching from GymMaster: ' + (e?.message ?? e));
      res.status(502).json(ApiResponse.mkErr('Failed to reach training system'));
      return;
    }

    // Map GymMaster records → the sync layer's TrainingUser shape. Skip any
    // record missing the two things we require: a stable id and a name.
    const incoming: data.TrainingUser[] = members
      .filter(m => m && typeof m.id === 'number' && m.fullname)
      .map(m => ({
        externalId: m.id,
        fullName: m.fullname,
        email: m.email ? m.email : null,
        phone: m.phonecell ? m.phonecell : null,
      }));

    const result = data.syncTrainingUsers(TRAINING_TOOL_ID, incoming);

    if ('error' in result) {
      res.status(500).json(ApiResponse.mkErr(result.error));
      return;
    }

    audit(
      req,
      `Training sync (tool ${TRAINING_TOOL_ID}, label ${TRAINING_LABEL_ID}): ` +
      `+${result.inserted} users, ~${result.updated} updated, ` +
      `+${result.granted} granted, -${result.revoked} revoked`
    );

    // Refresh the UI (tool user lists changed) and let boxes pick up the new
    // card set on their next hello.
    sendUpdate();

    res.json(ApiResponse.mkData(result));
  });

  return router;
}
