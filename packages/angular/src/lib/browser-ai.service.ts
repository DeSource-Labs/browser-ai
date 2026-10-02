import { Injectable } from '@angular/core';
import { createAngularLanguageDetector } from './controllers/create-angular-language-detector';
import { createAngularPromptApi } from './controllers/create-angular-prompt-api';
import { createAngularProofreader } from './controllers/create-angular-proofreader';
import { createAngularRewriter } from './controllers/create-angular-rewriter';
import { createAngularSummarizer } from './controllers/create-angular-summarizer';
import { createAngularTranslator } from './controllers/create-angular-translator';
import { createAngularWebMcp } from './controllers/create-angular-web-mcp';
import { createAngularWriter } from './controllers/create-angular-writer';

@Injectable({ providedIn: 'root' })
export class BrowserAiService {
  prompt(options: Omit<LanguageModelCreateOptions, 'monitor' | 'signal'> = {}) {
    return createAngularPromptApi(options);
  }
  summarizer(options: Omit<SummarizerCreateOptions, 'monitor' | 'signal'> = {}) {
    return createAngularSummarizer(options);
  }
  writer(options: Omit<WriterCreateOptions, 'monitor' | 'signal'> = {}) {
    return createAngularWriter(options);
  }
  rewriter(options: Omit<RewriterCreateOptions, 'monitor' | 'signal'> = {}) {
    return createAngularRewriter(options);
  }
  translator(options: Omit<TranslatorCreateOptions, 'monitor' | 'signal'>) {
    return createAngularTranslator(options);
  }
  languageDetector(options: Omit<LanguageDetectorCreateOptions, 'monitor' | 'signal'> = {}) {
    return createAngularLanguageDetector(options);
  }
  proofreader(options: Omit<ProofreaderCreateOptions, 'monitor' | 'signal'> = {}) {
    return createAngularProofreader(options);
  }
  webMcp() {
    return createAngularWebMcp();
  }
}
