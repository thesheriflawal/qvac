import api from "./api";

export interface Review {
  id: string;
  name: string;
  email: string;
  content: string;
  created_at: string;
}

export const reviewService = {
  getReviews: async (page = 1, pageSize = 10) => {
    const r = await api.get("/reviews", { params: { page, page_size: pageSize } });
    return r.data;
  },
  submitReview: async (data: { name: string; email: string; content: string }) => {
    const r = await api.post("/reviews", data);
    return r.data;
  },
};
