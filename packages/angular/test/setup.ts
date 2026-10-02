import '@angular/compiler';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ReadableStream } from 'node:stream/web';

Object.defineProperty(globalThis, 'ReadableStream', { value: ReadableStream, configurable: true });

TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting(), {
  teardown: { destroyAfterEach: true }
});
