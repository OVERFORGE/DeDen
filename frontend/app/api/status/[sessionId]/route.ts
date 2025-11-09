import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

/**
 * This is the GET handler for http://your-site.com/api/status/[sessionId]
 * It checks the current status of a payment session.
 */
export async function GET(
  request: Request
  // We will no longer use the 'context' parameter
) {
  try {
    // --- THIS IS THE NEW FIX ---
    // We will manually parse the sessionId from the request URL
    const url = new URL(request.url);
    // The pathname will be /api/status/690a1a4f3e54af8e1d523612
    const pathSegments = url.pathname.split('/');
    // The last segment is the sessionId
    const sessionId = pathSegments[pathSegments.length - 1];
    // --- END OF FIX ---


    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID not provided' }, { status: 400 });
    }

    // 2. Find the session in the database
    const session = await db.paymentSession.findUnique({
      where: {
        id: sessionId,
      },
      // We only need the 'status' field
      select: {
        status: true,
      },
    });

    // 3. Handle 'Not Found'
    if (!session) {
      return NextResponse.json({ error: 'Payment session not found' }, { status: 404 });
    }

    // 4. Return the current status
    // This will be "pending", "confirmed", or "failed"
    return NextResponse.json({ status: session.status });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

