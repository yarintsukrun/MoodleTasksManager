// Vite/Vitest `?raw` imports return file contents as a string.
declare module '*?raw' {
  const content: string;
  export default content;
}
