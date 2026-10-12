import { api } from '@/services/api';

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const contactService = {
  async submit(input: ContactInput) {
    const response = await api.post('/contact', input);
    return response.data;
  },
};
