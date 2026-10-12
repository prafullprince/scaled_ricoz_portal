import api from "./axios";

export type HelpLink = {
  id: string;
  title: string;
  description: string;
  url: string;
};

export type HelpOptions = {
  selfHelp: HelpLink[];
  usefulLinks: HelpLink[];
};

export const HelpOptionsService = {
  async get() {
    const response = await api.get<{ options: HelpOptions }>("/contact/help-options");
    return response.data.options;
  },
  async save(options: HelpOptions) {
    const response = await api.put<{ options: HelpOptions }>("/contact/help-options", options);
    return response.data.options;
  },
  async send(input: { name: string; email: string; subject: string; message: string }) {
    const response = await api.post<{ message: string }>("/contact", input);
    return response.data.message;
  },
};
