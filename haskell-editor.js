document.addEventListener("DOMContentLoaded", () => {
  initLoadingScreen();
  initNavbar();
  initScrollTop();
  initDarkMode();
  try { initHaskellEditor(); } catch(e) { console.error("HaskellEditor:", e); }
});

function initLoadingScreen() {
  setTimeout(() => {
    const s = document.getElementById("loading-screen");
    if (s) s.classList.add("hidden");
  }, 1500);
}

function initScrollTop() {
  const btn = document.getElementById("scrollTopBtn");
  if (!btn) return;
  window.addEventListener("scroll", () => btn.classList.toggle("visible", window.scrollY > 400));
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function initDarkMode() {
  const toggle = document.getElementById("darkModeToggle");
  if (!toggle) return;
  const icon = toggle.querySelector("i");
  if (localStorage.getItem("darkMode") === "light") {
    document.body.classList.add("light-mode");
    icon.classList.replace("fa-moon", "fa-sun");
  }
  toggle.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    const isLight = document.body.classList.contains("light-mode");
    icon.classList.toggle("fa-moon", !isLight);
    icon.classList.toggle("fa-sun", isLight);
    localStorage.setItem("darkMode", isLight ? "light" : "dark");
  });
}

function initNavbar() {
  const menuToggle = document.getElementById("menuToggle");
  const navLinks = document.getElementById("navLinks");
  if (!menuToggle || !navLinks) return;
  let overlay = document.querySelector(".nav-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "nav-overlay";
    document.body.appendChild(overlay);
  }
  const toggleMenu = (open) => {
    const isOpen = open !== undefined ? open : !navLinks.classList.contains("active");
    navLinks.classList.toggle("active", isOpen);
    menuToggle.setAttribute("aria-expanded", isOpen);
    overlay.classList.toggle("active", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
    const icon = menuToggle.querySelector("i");
    if (icon) { icon.classList.toggle("fa-bars", !isOpen); icon.classList.toggle("fa-times", isOpen); }
  };
  menuToggle.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
  overlay.addEventListener("click", () => toggleMenu(false));
  navLinks.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => toggleMenu(false)));
  const isMobile = () => window.matchMedia("(max-width: 1024px)").matches;
  document.querySelectorAll(".dropdown-toggle").forEach((toggle) => {
    const parent = toggle.closest(".has-dropdown");
    const menu = parent?.querySelector(".dropdown-menu");
    if (!parent || !menu) return;
    let t;
    parent.addEventListener("mouseenter", () => { if (!isMobile()) { clearTimeout(t); parent.classList.add("open"); toggle.setAttribute("aria-expanded", "true"); } });
    parent.addEventListener("mouseleave", () => { if (!isMobile()) { t = setTimeout(() => { parent.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }, 250); } });
    toggle.addEventListener("click", (e) => { if (isMobile()) { e.preventDefault(); e.stopPropagation(); const o = parent.classList.toggle("open"); toggle.setAttribute("aria-expanded", o); } });
  });
  window.addEventListener("scroll", () => {
    const nav = document.querySelector(".navbar");
    if (nav) nav.style.background = window.scrollY > 100 ? "rgba(10,10,26,0.95)" : "rgba(10,10,26,0.85)";
  });
}

/* ─── Examples ─── */
const HASKELL_EXAMPLES = {
  hello: `main :: IO ()
main = do
    putStrLn "Hello, World!"
    putStrLn "Welcome to the Haskell Editor!"`,

  factorial: `-- Recursive factorial function
factorial :: Integer -> Integer
factorial 0 = 1
factorial n = n * factorial (n - 1)

main :: IO ()
main = do
    putStr "Factorial of 5 is: "
    print (factorial 5)`,

  lists: `-- List comprehensions
main :: IO ()
main = do
    let squares = [x*x | x <- [1..10]]
    let evens = [x | x <- [1..20], even x]
    
    putStr "Squares (1-10): "
    print squares
    
    putStr "Evens (1-20): "
    print evens`,

  fibonacci: `-- Infinite Fibonacci sequence with lazy evaluation
fibs :: [Integer]
fibs = 0 : 1 : zipWith (+) fibs (tail fibs)

main :: IO ()
main = do
    putStr "First 10 Fibonacci numbers: "
    print (take 10 fibs)`,

  mapfilter: `-- Using map and filter
main :: IO ()
main = do
    let nums = [1..10]
    let doubled = map (*2) nums
    let large = filter (>5) nums
    
    putStr "Original: "
    print nums
    
    putStr "Doubled: "
    print doubled
    
    putStr "Greater than 5: "
    print large`,

  types: `-- Custom Algebraic Data Types
data Shape = Circle Double | Rectangle Double Double
    deriving (Show)

area :: Shape -> Double
area (Circle r) = pi * r * r
area (Rectangle w h) = w * h

main :: IO ()
main = do
    let c = Circle 5.0
    let r = Rectangle 10.0 5.0
    
    putStr "Area of Circle: "
    print (area c)
    
    putStr "Area of Rectangle: "
    print (area r)`
};

/* ─── Piston API Executor ─── */
async function executeHaskell(code) {
  if (!code.trim()) {
    return { output: [], errors: ["No code to execute."] };
  }

  try {
    const response = await fetch("https://emkc.org/api/v2/piston/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: "haskell",
        version: "*",
        files: [{ name: "main.hs", content: code }],
        stdin: "",
        args: [],
        compile_timeout: 10000,
        run_timeout: 3000,
        compile_memory_limit: -1,
        run_memory_limit: -1
      })
    });

    if (!response.ok) {
      throw new Error("API request failed with status " + response.status);
    }

    const data = await response.json();
    const output = [];
    const errors = [];

    if (data.compile && data.compile.stderr) {
      errors.push(...data.compile.stderr.split("\\n").filter(l => l.trim()));
    }

    if (data.run && data.run.stderr) {
      errors.push(...data.run.stderr.split("\\n").filter(l => l.trim()));
    }

    if (data.run && data.run.stdout) {
      output.push(...data.run.stdout.split("\\n").filter(l => l.trim()));
    }

    if (output.length === 0 && errors.length === 0) {
      output.push("Process finished with no output.");
    }

    return { output, errors };

  } catch (error) {
    return { output: [], errors: ["Execution Error: " + error.message] };
  }
}

/* ─── Init Editor ─── */
function initHaskellEditor() {
  const editor = document.getElementById("hsEditor");
  if (!editor) return;
  const outputBody    = document.getElementById("hsOutputBody");
  const consoleBody   = document.getElementById("hsConsoleBody");
  const runBtn        = document.getElementById("hsRunBtn");
  const resetBtn      = document.getElementById("hsResetBtn");
  const copyBtn       = document.getElementById("hsCopyBtn");
  const saveBtn       = document.getElementById("hsSaveBtn");
  const exampleSelect = document.getElementById("hsExampleSelect");
  const lineNumbers   = document.getElementById("hsLineNumbers");
  const statusBadge   = document.getElementById("hsStatusBadge");
  const consoleClear  = document.getElementById("hsConsoleClear");

  const SAVE_KEY = "haskell-editor-draft";
  let runSeq = 0;
  const saved = localStorage.getItem(SAVE_KEY);
  editor.value = (saved && saved.trim().length > 0) ? saved : HASKELL_EXAMPLES.hello;
  updateLines();

  exampleSelect.addEventListener("change", () => {
    editor.value = HASKELL_EXAMPLES[exampleSelect.value];
    updateLines();
  });

  runBtn.addEventListener("click", runCode);

  resetBtn.addEventListener("click", () => {
    editor.value = HASKELL_EXAMPLES[exampleSelect.value];
    updateLines();
  });

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(editor.value);
      copyBtn.innerHTML = '<i class="fas fa-check"></i>';
      setTimeout(() => { copyBtn.innerHTML = '<i class="fas fa-copy"></i>'; }, 2000);
    } catch { logError("Could not copy to clipboard."); }
  });

  saveBtn.addEventListener("click", () => {
    localStorage.setItem(SAVE_KEY, editor.value);
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => { saveBtn.innerHTML = '<i class="fas fa-save"></i>'; }, 2000);
  });

  editor.addEventListener("input", updateLines);
  editor.addEventListener("scroll", () => { lineNumbers.scrollTop = editor.scrollTop; });

  editor.addEventListener("keydown", (e) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const s = editor.selectionStart;
      editor.value = editor.value.substring(0, s) + "    " + editor.value.substring(editor.selectionEnd);
      editor.selectionStart = editor.selectionEnd = s + 4;
      updateLines();
    }
    if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); runCode(); }
    if (e.ctrlKey && e.key === "s") { e.preventDefault(); localStorage.setItem(SAVE_KEY, editor.value); }
  });

  consoleClear.addEventListener("click", () => {
    consoleBody.innerHTML = '<span class="hs-console-placeholder">No errors detected.</span>';
  });

  async function runCode() {
    const seq = ++runSeq;
    setStatus("running");
    outputBody.innerHTML = '<span class="hs-output-placeholder">Compiling and running...</span>';
    consoleBody.innerHTML = '<span class="hs-console-placeholder">No errors detected.</span>';

    const { output, errors } = await executeHaskell(editor.value);
    if (seq !== runSeq) return; // Prevent race conditions

    if (output.length > 0) {
      outputBody.innerHTML = "";
      output.forEach((line) => {
        const el = document.createElement("span");
        el.className = "hs-output-line";
        el.textContent = line;
        outputBody.appendChild(el);
      });
    } else {
      outputBody.innerHTML = '<span class="hs-output-placeholder">No standard output produced.</span>';
    }

    if (errors.length > 0) {
      consoleBody.innerHTML = "";
      errors.forEach(logError);
      setStatus("error");
    } else {
      setStatus("ready");
    }
  }

  function logError(msg) {
    const placeholder = consoleBody.querySelector(".hs-console-placeholder");
    if (placeholder) placeholder.remove();
    const el = document.createElement("span");
    el.className = "hs-console-line";
    el.textContent = msg;
    consoleBody.appendChild(el);
  }

  function setStatus(state) {
    const map = {
      ready:   ["Ready",   "hs-status-ready"],
      running: ["Running", "hs-status-running"],
      error:   ["Error",   "hs-status-error"]
    };
    const [text, cls] = map[state] || map.ready;
    statusBadge.textContent = text;
    statusBadge.className = `hs-status-badge ${cls}`;
  }

  function updateLines() {
    const count = editor.value.split("\\n").length;
    lineNumbers.textContent = Array.from({ length: Math.max(count, 1) }, (_, i) => i + 1).join("\\n");
  }
}