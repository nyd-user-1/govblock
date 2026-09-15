"""
An OpenAI-compatible chat endpoint on 127.0.0.1 that answers from Amazon
Bedrock under the worker box's instance role. autoclip speaks to "openai"
with a base URL; pointed here, it reaches Claude on Bedrock and is never
handed a key (its DashScope provider logs keys in plain text).

Non-streaming chat completions and the model list only: all autoclip uses.

    python3 bedrock_shim.py            # 127.0.0.1:8765
    autoclip run ... --provider openai --base-url http://127.0.0.1:8765/v1 --model us.anthropic.claude-sonnet-4-6 --api-key none
"""

import json
import os
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import boto3
from botocore.config import Config

PORT = int(os.getenv("SHIM_PORT", "8765"))
REGION = os.getenv("AWS_REGION", "us-east-1")
DEFAULT_MODEL = os.getenv("SHIM_MODEL", "us.anthropic.claude-sonnet-4-6")

bedrock = boto3.client("bedrock-runtime", region_name=REGION, config=Config(read_timeout=300, retries={"max_attempts": 8, "mode": "adaptive"}))


def text_of(content):
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return str(content or "")


def converse(body):
    system, messages = [], []
    for m in body.get("messages", []):
        role, text = m.get("role"), text_of(m.get("content"))
        if not text:
            continue
        if role == "system":
            system.append({"text": text})
            continue
        role = "assistant" if role == "assistant" else "user"
        if messages and messages[-1]["role"] == role:
            messages[-1]["content"][0]["text"] += "\n\n" + text
        else:
            messages.append({"role": role, "content": [{"text": text}]})
    model = body.get("model") or DEFAULT_MODEL
    if not model.startswith(("us.", "global.", "anthropic.", "arn:")):
        model = DEFAULT_MODEL
    inference = {"maxTokens": int(body.get("max_tokens") or 8192)}
    if body.get("temperature") is not None:
        inference["temperature"] = float(body["temperature"])
    r = bedrock.converse(modelId=model, messages=messages, inferenceConfig=inference, **({"system": system} if system else {}))
    out = "".join(block.get("text", "") for block in r["output"]["message"]["content"])
    usage = r.get("usage", {})
    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": out}, "finish_reason": "length" if r.get("stopReason") == "max_tokens" else "stop"}],
        "usage": {"prompt_tokens": usage.get("inputTokens", 0), "completion_tokens": usage.get("outputTokens", 0), "total_tokens": usage.get("totalTokens", 0)},
    }


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, payload):
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.rstrip("/").endswith("/models"):
            return self.reply(200, {"object": "list", "data": [{"id": DEFAULT_MODEL, "object": "model", "owned_by": "bedrock"}]})
        self.reply(404, {"error": {"message": "not found"}})

    def do_POST(self):
        if not self.path.rstrip("/").endswith("/chat/completions"):
            return self.reply(404, {"error": {"message": "not found"}})
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
            if body.get("stream"):
                return self.reply(400, {"error": {"message": "streaming is not supported by this shim"}})
            self.reply(200, converse(body))
        except Exception as e:  # noqa: BLE001 — the caller retries; the log keeps the reason
            print(f"{time.strftime('%H:%M:%S')} error: {e}", flush=True)
            self.reply(502, {"error": {"message": str(e)}})

    def log_message(self, fmt, *args):
        print(f"{time.strftime('%H:%M:%S')} {fmt % args}", flush=True)


if __name__ == "__main__":
    print(f"bedrock shim on 127.0.0.1:{PORT}, default model {DEFAULT_MODEL}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
