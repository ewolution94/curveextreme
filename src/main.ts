import '@fontsource/unbounded/600.css';
import '@fontsource/unbounded/800.css';
import './app.css';
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
