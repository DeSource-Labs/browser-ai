# Why Browser AI Kit

Chrome's built-in AI APIs make local inference possible. Browser AI Kit makes it practical inside a framework application.

## What the native APIs already do well

The browser provides the model, hardware acceleration, local execution, resource management, and specialized capabilities. Browser AI Kit deliberately does not hide that architecture behind a generic cloud-SDK shape.

Calling the native API directly is a sound choice for a small experiment or a single controlled interaction.

## What production applications still need

The first native call is short. The surrounding feature is not:

- support and eligibility vary by browser, device, profile, and API;
- models and language packs may need a user-initiated download;
- sessions consume browser-managed resources and require cleanup;
- streaming can create excessive framework rendering;
- long text must be measured, divided safely, and merged meaningfully;
- Prompt API histories can exceed the context window after many turns;
- Nuxt must render safely when browser globals do not exist;
- cancellations, reloads, stale work, and errors must leave the UI consistent.

Those concerns repeat across every product and every built-in AI surface. The kit centralizes them and exposes the resulting state through framework-native primitives.

## A thin wrapper where it should be, an opinionated layer where it must be

Simple operations remain recognizable. `prompt()`, `summarize()`, `write()`, `rewrite()`, `translate()`, `detect()`, and `proofread()` map directly to their browser counterparts.

The package becomes more opinionated around failure-prone lifecycle work:

| Problem                  | Browser AI Kit approach                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| Native object reactivity | Store sessions in shallow refs; never deep-proxy browser objects                                  |
| Stream rendering         | Coalesce visible updates to animation frames                                                      |
| Long summaries           | Measure native quota, summarize safe chunks, recursively roll up                                  |
| Long translations        | Split on text boundaries and preserve ordered output                                              |
| Large chat history       | Measure the real context window, cache summaries, restore recent context, compact before overflow |
| Saved chats              | Persist messages and summary cache in IndexedDB                                                   |
| Nuxt rendering           | Register components client-side and keep server evaluation safe                                   |
| WebMCP lifecycle         | Tie registrations to abort signals and Vue scope disposal                                         |

## How it compares with common alternatives

There is no equivalent mature framework library covering this full browser surface today. The meaningful choices are native code, a hosted-model SDK, or Browser AI Kit.

| Question                          | Native API                      | Hosted-model SDK        | Browser AI Kit                  |
| --------------------------------- | ------------------------------- | ----------------------- | ------------------------------- |
| Where does inference run?         | Chrome                          | Provider infrastructure | Chrome                          |
| API key required?                 | No                              | Usually                 | No                              |
| Prompts leave the device?         | No, for the built-in model call | Yes                     | No, for the built-in model call |
| Works across browsers?            | No                              | Usually                 | No; intentionally Chrome-native |
| Framework lifecycle included?     | No                              | Varies                  | Yes                             |
| Local model download UX included? | No                              | Not applicable          | Yes                             |
| Long-input strategy included?     | No                              | Varies                  | Yes, per API                    |
| Ready-made UI included?           | No                              | Rarely                  | Yes, optional                   |

A hosted model is not inherently worse; it serves different requirements, including cross-browser reach and larger models. The important distinction is to make the network and privacy boundary explicit.

## When not to use the kit

Use something else when:

- the feature must work in Safari, Firefox, or unsupported Chrome devices;
- a server must guarantee one model and version for every user;
- the task exceeds the local model's capability or context;
- your organization does not allow experimental browser features;
- the native call is so small that lifecycle abstraction would add more code than it removes.

Browser AI Kit is strongest when local privacy, instant repeated use, offline-capable inference, and a polished framework integration matter more than universal browser reach.
