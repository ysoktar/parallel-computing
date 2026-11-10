#!/usr/bin/env python3
"""
Local code runner for the Parallel Computing study site.

    python3 runner.py            (Windows: py runner.py)

Listens on http://127.0.0.1:7457 and lets the site's "Run" buttons compile and run the course programs on THIS
computer: C++ programs on the CPU (g++ / clang++, or MSVC cl.exe on Windows), CUDA programs on the GPU with nvcc
(when nvcc and an NVIDIA GPU are present). Standard library only, no installation.

On Windows nvcc needs Microsoft's C++ compiler (cl.exe) for the host side of every .cu file. The runner finds a
Visual Studio / Build Tools installation by itself (vswhere + vcvars64.bat), so a normal terminal is enough.

Safety: it binds to 127.0.0.1 only (other machines cannot reach it) and accepts requests only from the study site's
own origins (below), so other web pages you visit cannot use it. It runs whatever code the site sends, with your user
rights, in a temporary folder, with a time limit. Stop it with Ctrl+C when you are done.
"""
import glob, json, os, platform, shlex, shutil, subprocess, sys, tempfile, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("RUNNER_PORT", "7457"))
ALLOWED_ORIGINS = {"https://ysoktar.github.io"}
ALLOWED_LOCAL_PREFIXES = ("http://localhost:", "http://127.0.0.1:")  # the site served by `npm run dev`
COMPILE_TIMEOUT, RUN_TIMEOUT, MAX_OUT = 180, 20, 64 * 1024
WINDOWS = os.name == "nt"
EXE = ".exe" if WINDOWS else ""
TEXT = {"text": True, "encoding": "utf-8", "errors": "replace"}


# ------------------------------------------------------------------ toolchain discovery
def find_msvc_env():
    """Windows: an environment in which cl.exe works (the current one, or one produced by vcvars64.bat)."""
    if not WINDOWS:
        return None
    if shutil.which("cl"):
        return dict(os.environ)
    roots = []
    pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
    vswhere = os.path.join(pf86, "Microsoft Visual Studio", "Installer", "vswhere.exe")
    if os.path.exists(vswhere):
        try:
            out = subprocess.run([vswhere, "-all", "-products", "*", "-requires", "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
                                  "-property", "installationPath"], capture_output=True, timeout=30, **TEXT)
            roots += [l.strip() for l in out.stdout.splitlines() if l.strip()]
        except Exception:
            pass
    for base in (os.environ.get("ProgramFiles", r"C:\Program Files"), pf86):
        roots += sorted(glob.glob(os.path.join(base, "Microsoft Visual Studio", "*", "*")), reverse=True)
    for root in roots:
        bat = os.path.join(root, "VC", "Auxiliary", "Build", "vcvars64.bat")
        if not os.path.exists(bat):
            continue
        try:
            out = subprocess.run(f'cmd /s /c ""{bat}" >nul 2>&1 && set"', capture_output=True, timeout=60, shell=False, **TEXT)
        except Exception:
            continue
        env = {}
        for line in out.stdout.splitlines():
            k, sep, v = line.partition("=")
            if sep and k:
                env[k] = v
        path = env.get("PATH") or env.get("Path")
        if path and shutil.which("cl", path=path):
            return env
    return None


def gpu_name():
    smi = shutil.which("nvidia-smi")
    if not smi:
        return None
    try:
        out = subprocess.run([smi, "--query-gpu=name,compute_cap", "--format=csv,noheader"], capture_output=True, timeout=10, **TEXT)
        line = out.stdout.strip().splitlines()[0] if out.returncode == 0 and out.stdout.strip() else ""
        return line or None
    except Exception:
        return None


def discover():
    msvc = find_msvc_env()
    cl = shutil.which("cl", path=(msvc.get("PATH") or msvc.get("Path"))) if msvc else None
    gxx = shutil.which("g++") or shutil.which("clang++")
    if gxx:
        cxx = {"kind": "gcc", "path": gxx, "name": os.path.basename(gxx).replace(".exe", ""), "flags": "-O2 -std=c++17 -pthread", "env": None}
    elif cl:
        cxx = {"kind": "msvc", "path": cl, "name": "cl", "flags": "/O2 /std:c++17 /EHsc /nologo", "env": msvc}
    else:
        cxx = None
    nvcc = shutil.which("nvcc")
    return {"cxx": cxx, "nvcc": nvcc, "msvc": msvc, "cl": cl, "gpu": gpu_name()}


TC = discover()
CUDA_FLAGS = "-O2 -std=c++17 -arch=native"


def info():
    return {
        "runner": 2,
        "os": platform.system(),
        "cxx": TC["cxx"]["path"] if TC["cxx"] else None,
        "cxx_name": TC["cxx"]["name"] if TC["cxx"] else None,
        "nvcc": TC["nvcc"],
        "host_compiler": TC["cl"] if WINDOWS else (TC["cxx"]["path"] if TC["cxx"] else None),
        "gpu": TC["gpu"],
        "defaults": {"cuda": CUDA_FLAGS, "cpp": TC["cxx"]["flags"] if TC["cxx"] else "-O2 -std=c++17 -pthread"},
    }


def clip(s):
    return s if len(s) <= MAX_OUT else s[:MAX_OUT] + "\n… (output truncated)"


def split(s):
    return shlex.split(s or "", posix=not WINDOWS)


NO_CL = ("nvcc needs Microsoft's C++ compiler (cl.exe) on Windows and none was found.\n"
         "Install 'Build Tools for Visual Studio 2022' (free) with the workload 'Desktop development with C++':\n"
         "  https://visualstudio.microsoft.com/visual-cpp-build-tools/\n"
         "then restart runner.py (it finds cl.exe by itself; no Developer Prompt needed).")


# ------------------------------------------------------------------ compile and run
def run_code(lang, code, flags=None, args=None):
    with tempfile.TemporaryDirectory(prefix="pc-run-") as d:
        exe = os.path.join(d, "prog" + EXE)
        env = None
        if lang == "cuda":
            if not TC["nvcc"]:
                return {"ok": False, "stage": "setup", "stderr": "nvcc not found: install the CUDA Toolkit (and an NVIDIA driver) to run CUDA programs."}
            if WINDOWS and not TC["msvc"]:
                return {"ok": False, "stage": "setup", "stderr": NO_CL}
            env = TC["msvc"] if WINDOWS else None
            src = os.path.join(d, "prog.cu")
            fl = split(CUDA_FLAGS if flags is None else flags)
            cmds = [[TC["nvcc"]] + fl + [src, "-o", exe]]
            if "-arch=native" in fl:                  # older nvcc: retry without it
                cmds.append([TC["nvcc"]] + [f for f in fl if f != "-arch=native"] + [src, "-o", exe])
        elif lang == "cpp":
            cxx = TC["cxx"]
            if not cxx:
                msg = "No C++ compiler found (g++ or clang++)." + ("\n" + NO_CL.replace("nvcc needs", "C++ programs and nvcc need") if WINDOWS else "")
                return {"ok": False, "stage": "setup", "stderr": msg}
            env = cxx["env"]
            src = os.path.join(d, "prog.cpp")
            fl = split(cxx["flags"] if flags is None else flags)
            cmds = [[cxx["path"]] + fl + [src, "/Fe" + exe]] if cxx["kind"] == "msvc" else [[cxx["path"]] + fl + [src, "-o", exe]]
        else:
            return {"ok": False, "stage": "setup", "stderr": f"unknown language {lang!r}"}
        with open(src, "w", encoding="utf-8") as f:
            f.write(code)

        def show(cmd):
            def one(c):
                if c == src: return os.path.basename(src)
                if c == exe: return "prog" + EXE
                if c == "/Fe" + exe: return "/Feprog" + EXE
                return c
            return " ".join([os.path.basename(cmd[0])] + [one(c) for c in cmd[1:]])

        t0 = time.time()
        for cmd in cmds:
            try:
                comp = subprocess.run(cmd, capture_output=True, timeout=COMPILE_TIMEOUT, cwd=d, env=env, **TEXT)
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
            r = subprocess.run([exe] + argv, capture_output=True, timeout=RUN_TIMEOUT, cwd=d, env=env, **TEXT)
        except subprocess.TimeoutExpired:
            return {"ok": False, "stage": "run", "cmd": show(cmd), "stderr": f"the program ran longer than {RUN_TIMEOUT} s and was stopped", "compile_s": t_compile}
        warn = comp.stderr if lang == "cuda" or not WINDOWS else ""   # cl.exe prints the file name on stdout: skip it
        return {"ok": r.returncode == 0, "stage": "run", "exit": r.returncode, "stdout": clip(r.stdout), "stderr": clip(warn + r.stderr),
                "compile_s": t_compile, "run_s": time.time() - t1,
                "cmd": show(cmd) + "  &&  " + ("prog" + EXE if WINDOWS else "./prog") + ("" if not argv else " " + " ".join(argv))}


# ------------------------------------------------------------------ HTTP
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
    if WINDOWS:
        print(f"  cl.exe (MSVC): {TC['cl'] or 'not found  <- needed by nvcc on Windows: install Build Tools for Visual Studio 2022, workload Desktop development with C++'}")
    print(f"  GPU          : {i['gpu'] or 'not found'}")
    print(f"  listening on http://127.0.0.1:{PORT}  (Ctrl+C to stop)")
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")
        sys.exit(0)
