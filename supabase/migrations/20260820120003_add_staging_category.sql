-- 新增 Staging(房屋软装/看房布置)类目。services.category_id 有外键→categories(id),
-- 故先补进 categories 表,否则发布 staging 服务会违反外键。保留美容美发(beauty)不动。
INSERT INTO public.categories (id, label, description, image_path, sort_order) VALUES
  ('staging', '找Staging', '房屋软装、看房布置、家具租摆', '/images/categories/staging.svg', 23)
ON CONFLICT (id) DO NOTHING;

UPDATE public.categories SET sort_order = 99 WHERE id = 'other';
