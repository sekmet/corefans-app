const styleMock: Record<string, string> = new Proxy({}, {
  get: (_, prop: string) => prop,
});
export default styleMock;
