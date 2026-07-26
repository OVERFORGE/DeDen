// File: app/api/admin/activity/route.ts
// GET — admin only. Paginated ActivityLog feed. ActivityLog rows are
// already written everywhere (approvals, payments, refunds, check-ins,
// referral changes) but there was previously no way to see them without a
// direct DB query.

import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { requireAdmin, authErrorResponse } from '@/lib/api-auth';

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '30', 10) || 30));
    const action = searchParams.get('action');
    const entity = searchParams.get('entity');

    const where: any = {};
    if (action) where.action = action;
    if (entity) where.entity = entity;

    const [total, logs] = await Promise.all([
      db.activityLog.count({ where }),
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, displayName: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return NextResponse.json({
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        details: log.details,
        createdAt: log.createdAt,
        user: log.userId ? userMap.get(log.userId) || { displayName: 'Unknown', email: null } : null,
      })),
    });
  } catch (error) {
    if ((error as any).status) {
      return authErrorResponse(error);
    }
    console.error('[API] Error fetching activity log:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
