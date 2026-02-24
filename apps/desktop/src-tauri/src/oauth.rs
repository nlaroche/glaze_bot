use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::mpsc;
use std::sync::Mutex;
use tauri::State;

pub struct OAuthState {
    pub receiver: Mutex<Option<mpsc::Receiver<String>>>,
}

const CALLBACK_HTML: &str = r#"<!DOCTYPE html>
<html>
<head><title>GlazeBot</title></head>
<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#e2e8f0">
<div style="text-align:center">
<h2>Sign-in successful</h2>
<p>You can close this tab and return to GlazeBot.</p>
</div>
<script>
// If Supabase returned params in the URL fragment (implicit flow fallback),
// re-request with them as query params so the server can capture them.
if (window.location.hash && window.location.hash.length > 1) {
  var params = window.location.hash.substring(1);
  window.location.replace(window.location.pathname + '?' + params);
}
</script>
</body>
</html>"#;

/// Start a temporary localhost HTTP server on a random port.
/// Returns the port number. The server accepts one connection, captures the
/// full callback URL, serves a "close this tab" page, then shuts down.
#[tauri::command]
pub fn start_oauth_server(state: State<'_, OAuthState>) -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();

    let (tx, rx) = mpsc::channel::<String>();

    // Store the receiver so wait_for_oauth_callback can read it.
    {
        let mut guard = state.receiver.lock().map_err(|e| e.to_string())?;
        *guard = Some(rx);
    }

    std::thread::spawn(move || {
        // Accept up to 2 connections: the first may carry a fragment-only redirect
        // that triggers a JS-based reload with query params on the second request.
        for _ in 0..2 {
            let Ok((mut stream, _)) = listener.accept() else { break };
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request = String::from_utf8_lossy(&buf[..n]);

            let path = request
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .unwrap_or("/");
            let callback_url = format!("http://localhost:{}{}", port, path);

            // Send the callback page (includes JS to forward fragment as query params).
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                CALLBACK_HTML.len(),
                CALLBACK_HTML,
            );
            let _ = stream.write_all(response.as_bytes());
            let _ = stream.flush();
            drop(stream);

            // If the URL has a code or access_token query param, we're done.
            if path.contains("code=") || path.contains("access_token=") {
                let _ = tx.send(callback_url);
                return;
            }
        }
        // If we never got a code, send whatever we have so the frontend can report the error.
        let _ = tx.send(String::new());
    });

    Ok(port)
}

/// Block until the OAuth callback is received. Returns the full callback URL.
#[tauri::command]
pub fn wait_for_oauth_callback(state: State<'_, OAuthState>) -> Result<String, String> {
    let rx = {
        let mut guard = state.receiver.lock().map_err(|e| e.to_string())?;
        guard.take().ok_or("No OAuth server running")?
    };

    rx.recv()
        .map_err(|_| "OAuth callback channel closed without a response".to_string())
}
