import { NextRequest, NextResponse } from "next/server";

async function proxyRequest(request: NextRequest, pathArray: string[]) {
  const BACKEND = (process.env.BACKEND_URL || "").replace(/\/$/, "");
  
  const path = pathArray.join("/");
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${BACKEND}/${path}${searchParams ? `?${searchParams}` : ""}`;

  try {
    const bodyBuffer = ["GET", "HEAD"].includes(request.method)
      ? undefined
      : new Uint8Array(await request.arrayBuffer());

    console.log(`[Proxy] ${request.method} ${targetUrl}`);
    
    // Only pass essential headers to avoid conflicts
    const proxyHeaders = new Headers();
    const originalHeaders = new Headers(request.headers);
    
    const allowedHeaders = ["content-type", "authorization", "user-agent", "accept", "idempotency-key"];
    allowedHeaders.forEach(h => {
      if (originalHeaders.has(h)) {
        proxyHeaders.set(h, originalHeaders.get(h)!);
      }
    });

    // Ensure Accept is always set if not provided
    if (!proxyHeaders.has("accept")) {
      proxyHeaders.set("Accept", "application/json");
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: bodyBuffer,
      cache: "no-store",
    });

    console.log(`[Proxy] Response: ${response.status} ${response.statusText}`);

    const responseData = await response.arrayBuffer();

    const responseHeaders = new Headers(response.headers);
    // Remove problematic headers for the response
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("content-length");
    responseHeaders.delete("transfer-encoding");
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new NextResponse(responseData, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error(`[Proxy] ${request.method} ${targetUrl} FAILED:`, error.message);
    if (error.cause) {
      console.error(`[Proxy] Cause:`, error.cause);
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: "Proxy Error", 
        error: error.message,
        cause: error.cause?.message || String(error.cause || "")
      },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
