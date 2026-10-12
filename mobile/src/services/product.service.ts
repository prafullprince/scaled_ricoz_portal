import { api } from '@/services/api';

export const productService = {
  async list() {
    const response = await api.get('/products');
    return response.data.products ?? response.data;
  },
  async adminList() {
    const response = await api.get('/products/admin');
    return response.data.products ?? response.data;
  },
  async progress(productId: string) {
    const response = await api.get(`/products/${productId}/progress`);
    return response.data;
  },
  async heads() {
    const response = await api.get('/products/heads');
    return response.data.heads ?? response.data;
  },
  async update(productId: string, input: { title?: string; description?: string; techStack?: string[]; developer?: string; status?: string }) {
    const response = await api.put(`/products/admin/${productId}`, input);
    return response.data;
  },
  async remove(productId: string) {
    await api.delete(`/products/admin/${productId}`);
  },
  async dispatch(productId: string, input: { department: string; deadline: string; executiveAssignment?: boolean; headId?: string; note?: string }) {
    const response = await api.post(`/products/admin/${productId}/dispatch`, input);
    return response.data;
  },
};
