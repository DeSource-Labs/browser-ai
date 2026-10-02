# Browser setup and support

Browser AI Kit uses Chrome's built-in models for private, on-device AI. Prompts are processed locally, and the kit adds no inference server or API key. Chrome manages the models, downloads, and device requirements. See [Chrome's built-in AI overview](https://developer.chrome.com/docs/ai/built-in/overview) for how local processing works.

## Try it in your browser

1. Open the [live examples](https://ai.desourcelabs.com/#apis) in Chrome and choose an API. The page checks support in your current browser profile.
2. If the API needs a model or language pack, start it from the example's button and wait for the download to finish. An internet connection and enough device storage are needed for this step.
3. Send a prompt or run the text tool. After the required resources are installed, model processing happens on your device.

For your own app, follow the [package quick start](../README.md#quick-start) and serve it over HTTPS or localhost. Availability depends on the API, browser version, device, language, policy, and installed resources. A working package import does not guarantee that a model is available.

If the example reports `unavailable`, check [Chrome's requirements](https://developer.chrome.com/docs/ai/get-started) and the API-specific documentation below. Experimental APIs may need an origin trial or a local testing flag. Follow the current API instructions and restart Chrome after changing flags; enabling a flag does not make an unsupported device eligible.

## Availability and downloads

| State          | Application behavior                            |
| -------------- | ----------------------------------------------- |
| `available`    | Enable the action and create or reuse a session |
| `downloadable` | Explain the download and wait for a user action |
| `downloading`  | Show progress and keep the page open            |
| `unavailable`  | Keep the manual workflow available              |

Components show these states automatically. For a custom UI, use `init()` or the adapter's availability method with the same options and languages you will use for creation. Start model creation from a click or keyboard action when resources need downloading. A change in language pair or Prompt input type can require different resources and a new session.

## Offline use and privacy

Once the required model or language pack is installed, it can process requests offline. Your app must also be available offline for users to reach that feature. Downloads and updates need network access, and Chrome may remove resources under storage pressure, so check availability when the feature starts.

The kit does not upload prompts, responses, or attachments, and adds no telemetry. Saved chat text is stored locally in the browser. Your application's own network calls, any cloud fallback, and tools exposed through WebMCP have their own data flows.

## If something does not work

| Symptom                                                   | What to check                                                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| An API is unavailable                                     | Check the API's Chrome requirements, device eligibility, requested languages, and browser policy. Each API is detected separately. |
| A required download does not start                        | Start creation from a real click or keyboard action. Check the connection and Chrome's storage requirements.                       |
| Text prompts work, but an image or audio request does not | Check availability with the required `expectedInputs`. Support can differ by input type.                                           |
| A new translation pair needs another download             | Prepare that language pair from a user action; installed resources for one pair do not cover every language.                       |
| A feature works locally but not after deployment          | Check HTTPS, the API's origin-trial requirements, and document permissions. WebMCP has separate header requirements.               |

Include the package version, Chrome version, availability state, requested languages, and a small reproduction when [reporting a problem](https://github.com/DeSource-Labs/browser-ai/issues).

## Prompt inputs and saved history

Prompt API supports the input types exposed by the browser. Declare the text, image, or audio inputs your session needs. The core attachment helpers preserve native image/audio values and decode bounded text files locally; they do not parse PDF or office-document formats. See the [attachment examples](../packages/core/README.md#attachments-and-text-files).

Specialized APIs such as Summarizer, Translator, and Proofreader consume text. Their components accept text files through local extraction.

Saved conversations retain completed text, extracted file text, and context summaries. Image/audio bytes stay in the conversation controller's memory and are lost on reload. Reattach a file when a new session needs its original binary content. See the [core guide](../packages/core/README.md#what-survives-a-reload).

## Unsupported environments

Server imports do not create browser sessions. Run model operations in the browser and dispose controllers with their owning component or screen. Components expose unavailable and error states when browser globals are absent.

Keep manual editing or another non-AI path available. If your application offers a hosted fallback, disclose that prompts will leave the device before switching. The library does not provide that fallback.

## WebMCP

WebMCP lets a browser agent discover and call tools your app exposes. It is detected separately from local model APIs and does not determine where the agent's model runs. Use `getWebMcpSupport()` for secure-context, origin-isolation, and permission diagnostics. Register tools only while their UI and authorization context exist.

Follow the [WebMCP guide](webmcp.md) for registration, input-format compatibility, declarative forms, and headers.

## Browser setup and API documentation

Use Chrome's documentation for current device requirements, supported languages, origin trials, and development flags. Flags are for local testing and do not establish production availability.

- [Built-in AI](https://developer.chrome.com/docs/ai/built-in)
- [Prompt API](https://developer.chrome.com/docs/ai/prompt-api)
- [Session management](https://developer.chrome.com/docs/ai/session-management)
- [Summarizer](https://developer.chrome.com/docs/ai/summarizer-api)
- [Writer and Rewriter](https://developer.chrome.com/docs/ai/writer-api)
- [Translator](https://developer.chrome.com/docs/ai/translator-api)
- [Language Detector](https://developer.chrome.com/docs/ai/language-detection)
- [Proofreader](https://developer.chrome.com/docs/ai/proofreader-api)
- [WebMCP](https://developer.chrome.com/docs/ai/webmcp)

For repository browser tests and reporting requirements, see [Contributing](../CONTRIBUTING.md#local-browser-tests).
