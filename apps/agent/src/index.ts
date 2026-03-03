import { createServer } from "./server.js";
import { CONFIG } from "./config.js";

async function main() {
  const app = await createServer();

  try {
    await app.listen({ port: CONFIG.PORT, host: "0.0.0.0" });
    console.log(`\n🤖 Arbiter Intent Engine running on port ${CONFIG.PORT}`);
    console.log(`   Mode: ${CONFIG.SIMULATION_MODE ? "SIMULATION" : "LIVE"}`);
    console.log(`   AI:   ${CONFIG.GROQ_API_KEY ? "Groq/" + CONFIG.AI_MODEL : CONFIG.OPENAI_API_KEY ? "OpenAI" : "Rule-based"}`);
    console.log(`   Docs: http://localhost:${CONFIG.PORT}/health\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
