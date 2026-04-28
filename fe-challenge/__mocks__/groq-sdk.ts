export default jest.fn().mockImplementation(() => ({
  chat: {
    completions: {
      create: jest.fn().mockResolvedValue({
        choices: [{ delta: { content: 'mock response' } }],
      }),
    },
  },
}));