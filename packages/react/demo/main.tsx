import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../../common/demo/demo.css';
import '../src/style.scss';
import { App } from './App';

createRoot(document.querySelector('#root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
