// The page's entry. Phase 0 grows this into the observatory shell; for now it says
// what is being built and links back to Classic.
import "./styles.css";

const app = document.getElementById("app");
if (app) {
  app.innerHTML = `
    <h1>Causalis Universe</h1>
    <p class="lede">A deterministic universe, from a seed to interstellar war, that you can watch,
    question and touch. It is being built beside <a href="../">Causalis Classic</a>.</p>
    <p class="status">Phase 0 · the kernel is under construction.</p>`;
}
