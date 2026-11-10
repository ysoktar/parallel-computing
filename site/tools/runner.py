#!/usr/bin/env python3
"""
Local code runner for the Parallel Computing study site.

    python3 runner.py            (Windows: py runner.py)

Listens on http://127.0.0.1:7457 and lets the site's "Run" buttons compile and run the course programs on THIS
computer: C++ programs with g++ / clang++ on the CPU, CUDA programs with nvcc on the GPU (when nvcc and an NVIDIA GPU
are present). Standard library only, no installation.

Safety: it binds to 127.0.0.1 only (other machines cannot reach it) and accepts requests only from the study site's
own origins (below), so other web pages you visit cannot use it. It runs whatever code the site sends, with your user
rights, in a temporary folder, with a time limit. Stop it with Ctrl+C when you are done.
"""
import json, os, platform, shlex, shutil, subprocess, sys, tempfile, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("RUNNER_PORT", "7457"))
ALLOWED_ORIGINS = {"https://ysoktar.github.io"}
ALLOWED_LOCAL_PREFIXES = ("http://localhost:", "http://127.0.0.1:")  # the site served by `npm run dev`
COMPILE_TIMEOUT, RUN_TIMEOUT, MAX_OUT = 120, 20, 64 * 1024
EXE = ".exe" if os.name == "nt" else ""


def which_cxx():
    for c in ("g++", "clang++"):
        p = shutil.which(c)
        if p:
            return p
    return None


def gpu_name():
    smi = shutil.which("nvidia-smi")
    if not smi:
        return None
    try:
        out = subprocess.run([smi, "--query-gpu=name,compute_cap", "--format=csv,noheader"], capture_output=True, text=True, timeout=10)
        line = out.stdout.strip().splitlines()[0] if out.returncode == 0 and out.stdout.strip() else ""
        return line or None
    except Exception:
        return None


def info():
    return {
        "runner": 1,
        "os": platform.system(),
        "cxx": which_cxx(),
        "nvcc": shutil.which("nvcc"),
        "gpu": gpu_name(),
        "defaults": DEFAULT_FLAGS,
    }


def clip(s):
    return s if len(s) <= MAX_OUT else s[:MAX_OUT] + "\n… (output truncated)"


DEFAULT_FLAGS = {"cuda": "-O2 -std=c++17 -arch=native", "cpp": "-O2 -std=c++17 -pthread"}


def split(s):
    return shlex.split(s or "", posix=(os.name != "nt"))


def run_code(lang, code, flags=None, args=None):
    inf = info()
    with tempfile.TemporaryDirectory(prefix="pc-run-") as d:
        exe = os.path.join(d, "prog" + EXE)
        if lang == "cuda":
            if not inf["nvcc"]:
                return {"ok": False, "stage": "setup", "stderr": "nvcc not found: install the CUDA Toolkit (and an NVIDIA driver) to run CUDA programs."}
            compiler, src = inf["nvcc"], os.path.join(d, "prog.cu")
        elif lang == "cpp":
            if not inf["cxx"]:
                return {"ok": False, "stage": "setup", "stderr": "No C++ compiler found (g++ or clang++)."}
            compiler, src = inf["cxx"], os.path.join(d, "prog.cpp")
        else:
            return {"ok": False, "stage": "setup", "stderr": f"unknown language {lang!r}"}
        fl = split(DEFAULT_FLAGS[lang] if flags is None else flags)
        cmds = [[compiler] + fl + [src, "-o", exe]]
        if "-arch=native" in fl:                      # older nvcc / no GPU visible: retry without it
            cmds.append([compiler] + [f for f in fl if f != "-arch=native"] + [src, "-o", exe])
        with open(src, "w", encoding="utf-8") as f:
            f.write(code)
        show = lambda cmd: " ".join([os.path.basename(cmd[0])] + [("prog" + os.path.splitext(src)[1]) if c == src else ("prog" if c == exe else c) for c in cmd[1:]])
        t0 = time.time()
        for cmd in cmds:
            try:
                comp = subprocess.run(cmd, capture_output=True, text=True, timeout=COMPILE_TIMEOUT, cwd=d)
            except subprocess.TimeoutExpired:
                return {"ok": False, "stage": "compile", "cmd": show(cmd), "stderr": "compilation timed out"}
            except OSError as e:
                return {"ok": False, "stage": "compile", "cmd": show(cmd), "stderr": str(e)}
            if comp.returncode == 0:
                break
        t_compile = time.time() - t0
        if comp.returncode != 0:
            return {"ok": False, "stage": "compile", "cmd": show(cmd), "stdout": clip(comp.stdout), "stderr": clip(comp.stderr), "compile_s": t_compile}
        argv = split(args)
        t1 = time.time()
        try:
            r = subprocess.run([exe] + argv, capture_output=True, text=True, timeout=RUN_TIMEOUT, cwd=d)
        except subprocess.TimeoutExpired:
            return {"ok": False, "stage": "run", "cmd": show(cmd), "stderr": f"the program ran longer than {RUN_TIMEOUT} s and was stopped", "compile_s": t_compile}
        return {"ok": r.returncode == 0, "stage": "run", "exit": r.returncode, "stdout": clip(r.stdout), "stderr": clip(comp.stderr + r.stderr),
                "compile_s": t_compile, "run_s": time.time() - t1, "cmd": show(cmd) + ("  &&  ./prog " + " ".join(argv) if argv else "  &&  ./prog")}


class H(BaseHTTPRequestHandler):
    def origin_ok(self):
        o = self.headers.get("Origin", "")
        return o in ALLOWED_ORIGINS or o.startswith(ALLOWED_LOCAL_PREFIXES)

    def cors(self):
        o = self.headers.get("Origin", "")
        if self.origin_ok():
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Access-Control-Allow-Private-Network", "true")   # Chrome: public site → localhost

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204 if self.origin_ok() else 403)
        self.cors()
        self.end_headers()

    def do_GET(self):
        if not self.origin_ok():
            return self.reply(403, {"error": "origin not allowed"})
        if self.path.startswith("/info"):
            return self.reply(200, info())
        self.reply(404, {"error": "not found"})

    def do_POST(self):
        if not self.origin_ok():
            return self.reply(403, {"error": "origin not allowed"})
        if not self.path.startswith("/run"):
            return self.reply(404, {"error": "not found"})
        n = int(self.headers.get("Content-Length", "0"))
        if n > 1_000_000:
            return self.reply(413, {"error": "too large"})
        try:
            req = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return self.reply(400, {"error": "bad json"})
        res = run_code(req.get("lang"), req.get("code", ""), req.get("flags"), req.get("args"))
        print(f"[{time.strftime('%H:%M:%S')}] {req.get('name', '?')} ({req.get('lang')}): {res.get('stage')} {'ok' if res.get('ok') else 'failed'}")
        self.reply(200, res)

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    i = info()
    print("Parallel Computing local runner")
    print(f"  C++ compiler : {i['cxx'] or 'not found'}")
    print(f"  nvcc         : {i['nvcc'] or 'not found'}")
    print(f"  GPU          : {i['gpu'] or 'not found'}")
    print(f"  listening on http://127.0.0.1:{PORT}  (Ctrl+C to stop)")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
        sys.exit(0)
