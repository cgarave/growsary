import { getCatalogData } from "./actions";
import CatalogView from "./CatalogView";

export const revalidate = 86400; // Cache page for 24 hours (revalidated on-demand via revalidateTag)

export default async function Page() {
  const { categories, products } = await getCatalogData();

  return (
    <CatalogView
      initialCategories={categories}
      initialProducts={products}
    />
  );
}
