/**
 * Isolated Meeting SDK document (Zoom's React 18, not the CHT React 19 tree).
 * Loaded via blob: URL so we do not depend on /zoom-embed.html being in S3
 * (frontend deploy excludes *.html except index.html).
 */
export const ZOOM_EMBED_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CHT Zoom session</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0b0f14; color: #e5e7eb;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      #status { padding: 12px 14px; font-size: 13px; line-height: 1.4; }
      #meetingSDKElement { width: 100%; height: 100%; min-height: 480px; }
      .err { color: #fecaca; background: #7f1d1d; border-radius: 8px; margin: 12px; padding: 10px 12px; }
    </style>
    <script src="https://source.zoom.us/4.1.0/lib/vendor/react.min.js"></script>
    <script src="https://source.zoom.us/4.1.0/lib/vendor/react-dom.min.js"></script>
    <script src="https://source.zoom.us/4.1.0/lib/vendor/redux.min.js"></script>
    <script src="https://source.zoom.us/4.1.0/lib/vendor/redux-thunk.min.js"></script>
    <script src="https://source.zoom.us/4.1.0/lib/vendor/lodash.min.js"></script>
    <script src="https://source.zoom.us/zoom-meeting-embedded-4.1.0.min.js"></script>
  </head>
  <body>
    <div id="status">Preparing Zoom…</div>
    <div id="meetingSDKElement" aria-label="Zoom session"></div>
    <script>
      (function () {
        var STATUS = document.getElementById('status');
        var ROOT = document.getElementById('meetingSDKElement');
        var client = null;
        var joined = false;
        var parentOrigin = (function () {
          try { return parent.location.origin; } catch (e) { return '*'; }
        })();

        function setStatus(text, isError) {
          if (!STATUS) return;
          STATUS.textContent = text || '';
          STATUS.className = isError ? 'err' : '';
          STATUS.style.display = text ? 'block' : 'none';
        }

        function post(msg) {
          try { parent.postMessage(msg, parentOrigin); } catch (e) { /* ignore */ }
        }

        function isSdkFailure(r) {
          return r && typeof r === 'object' && 'type' in r && 'reason' in r;
        }

        async function leave() {
          if (!client) return;
          try { await client.leaveMeeting(); } catch (e) { /* ignore */ }
          if (joined) {
            joined = false;
            post({ type: 'cht-zoom-left' });
          }
          client = null;
          setStatus('Left session.');
        }

        async function join(creds) {
          setStatus('Connecting to Zoom…');
          if (!window.ZoomMtgEmbedded) {
            throw new Error('Zoom Meeting SDK failed to load. Check network / CSP.');
          }
          if (client || joined) await leave();

          client = ZoomMtgEmbedded.createClient();
          var initArgs = {
            zoomAppRoot: ROOT,
            language: 'en-US',
            patchJsMedia: true,
          };
          if (!window.crossOriginIsolated) initArgs.disableCORP = true;

          var initResult = await client.init(initArgs);
          if (isSdkFailure(initResult)) {
            throw new Error(initResult.reason || 'Could not start Zoom in the browser.');
          }

          var joinArgs = {
            signature: creds.signature,
            meetingNumber: creds.meetingNumber,
            password: creds.password || '',
            userName: creds.userName,
            userEmail: creds.userEmail || undefined,
          };
          if (creds.sdkKey) joinArgs.sdkKey = creds.sdkKey;
          if (creds.tk) joinArgs.tk = creds.tk;

          var joinResult = await client.join(joinArgs);
          if (isSdkFailure(joinResult)) {
            throw new Error(joinResult.reason || 'Could not join the session.');
          }

          joined = true;
          setStatus('');
          post({ type: 'cht-zoom-joined' });
        }

        window.addEventListener('message', function (event) {
          if (parentOrigin !== '*' && event.origin !== parentOrigin) return;
          var data = event.data;
          if (!data || typeof data !== 'object') return;
          if (data.type === 'cht-zoom-join') {
            join(data.payload || {}).catch(function (err) {
              var message = (err && err.message) ||
                'Could not start in-browser Zoom. Use Open in Zoom if needed.';
              setStatus(message, true);
              post({ type: 'cht-zoom-error', message: message });
            });
            return;
          }
          if (data.type === 'cht-zoom-leave') leave();
        });

        post({ type: 'cht-zoom-ready' });
        setStatus('Waiting for session credentials…');
      })();
    </script>
  </body>
</html>
`;
