import { mount } from 'svelte';
import '../../../common/demo/demo.css';
import '../src/lib/style.scss';
import App from './App.svelte';

mount(App, { target: document.querySelector('#app')! });
