import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url")?.trim() || "";
  if (!rawUrl) {
    return new NextResponse(
      renderFallbackHtml("No URL Provided", "Enter or select a website URL to preview in this tab."),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  let targetUrl = rawUrl;
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new NextResponse(
      renderFallbackHtml("Invalid Website URL", `Could not parse "${rawUrl}" as a valid URL.`),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const upstream = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    const contentType = upstream.headers.get("content-type") || "text/html";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      const buf = await upstream.arrayBuffer();
      return new NextResponse(buf, {
        status: upstream.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=300",
        },
      });
    }

    let html = await upstream.text();
    const finalUrl = upstream.url || parsed.toString();
    const finalOrigin = new URL(finalUrl).origin;

    // Remove <meta http-equiv="Content-Security-Policy" ...> or X-Frame-Options meta tags
    html = html.replace(
      /<meta[^>]+http-equiv=["']?(?:Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi,
      ""
    );

    // Inject <base> tag + in-tab link navigation interceptor so clicking links stays in this tab viewer
    const baseAndHelper = `
      <base href="${finalOrigin}/" />
      <script>
        document.addEventListener("click", function(e) {
          var a = e.target && e.target.closest ? e.target.closest("a") : null;
          if (!a) return;
          var href = a.getAttribute("href");
          if (!href || href.startsWith("#") || href.startsWith("javascript:") || href.startsWith("mailto:") || href.startsWith("tel:")) {
            if (a.target === "_blank") a.target = "_self";
            return;
          }
          try {
            var resolved = new URL(href, "${finalUrl}").toString();
            if (resolved.startsWith("http")) {
              e.preventDefault();
              window.location.href = "/api/site-preview?url=" + encodeURIComponent(resolved);
            }
          } catch (_) {}
        }, true);
      </script>
    `;

    if (/<head[^>]*>/i.test(html)) {
      html = html.replace(/<head[^>]*>/i, (match) => `${match}\n${baseAndHelper}`);
    } else {
      html = `${baseAndHelper}\n${html}`;
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Connection timed out or blocked by host";
    return new NextResponse(
      renderFallbackHtml(
        `Preview Notice for ${parsed.hostname}`,
        `Could not fetch live HTML directly (${msg}). You can still inspect the URL "${parsed.toString()}" or navigate in this tab.`,
        parsed.toString()
      ),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

function renderFallbackHtml(title: string, message: string, url?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    body {
      margin: 0;
      padding: 40px 24px;
      background: #0B0D12;
      color: #F4F5F7;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 75vh;
    }
    .card {
      max-width: 520px;
      background: #151821;
      border: 1px solid #292D38;
      border-radius: 16px;
      padding: 28px;
      text-align: center;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 18px;
      font-weight: 600;
    }
    p {
      margin: 0 0 18px;
      font-size: 13.5px;
      line-height: 1.55;
      color: #A0A5B2;
    }
    .url-box {
      font-family: "IBM Plex Mono", monospace;
      font-size: 12px;
      padding: 10px 12px;
      background: #1A1D27;
      border: 1px solid #292D38;
      border-radius: 8px;
      color: #659BFA;
      word-break: break-all;
      margin-bottom: 16px;
    }
    .btn {
      display: inline-block;
      padding: 10px 18px;
      background: #7958F5;
      color: #fff;
      text-decoration: none;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>${title}</h2>
    <p>${message}</p>
    ${url ? `<div class="url-box">${url}</div>` : ""}
    ${
      url
        ? `<a class="btn" href="/api/site-preview?url=${encodeURIComponent(url)}">Retry In-Tab Load</a>`
        : ""
    }
  </div>
</body>
</html>`;
}
