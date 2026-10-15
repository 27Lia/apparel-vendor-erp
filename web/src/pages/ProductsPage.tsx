import { useEffect, useState } from "react";
import {
  Upload,
  Button,
  Select,
  Input,
  Card,
  Row,
  Col,
  Tag,
  Typography,
  Space,
  message,
  Spin,
  Empty,
} from "antd";
import { UploadOutlined, SearchOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import type { UploadProps } from "antd";
import type { FilterOptions, Product } from "../types";

const { Text, Paragraph } = Typography;
const { Meta } = Card;

const emptyFilters: FilterOptions = { brands: [], color: [], category: [], style: [] };

export default function ProductsPage() {
  const [filters, setFilters] = useState<FilterOptions>(emptyFilters);
  const [query, setQuery] = useState<{ brand?: string; color?: string; category?: string; style?: string }>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [uploading, setUploading] = useState(false);
  const [textQuery, setTextQuery] = useState("");
  const [similarOf, setSimilarOf] = useState<Product | null>(null);
  const [similarResults, setSimilarResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [showingSimilar, setShowingSimilar] = useState(false);

  function closeSimilar() {
    setShowingSimilar(false);
    setSimilarOf(null);
    setSimilarResults([]);
  }

  async function loadFilters() {
    const res = await fetch("/api/products/filters");
    setFilters(await res.json());
  }

  async function search(q = query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(q)) {
      if (value) params.set(key, value);
    }
    const res = await fetch(`/api/products?${params.toString()}`);
    setProducts(await res.json());
  }

  useEffect(() => {
    loadFilters();
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchByText() {
    if (!textQuery.trim()) return;
    setSearching(true);
    setSimilarOf(null);
    setShowingSimilar(true);
    try {
      const res = await fetch(`/api/products/search/text?q=${encodeURIComponent(textQuery)}`);
      const data = await res.json();
      setSimilarResults(data.results ?? []);
    } finally {
      setSearching(false);
    }
  }

  async function showSimilar(p: Product) {
    setSimilarOf(p);
    setShowingSimilar(true);
    setSearching(true);
    try {
      const res = await fetch(`/api/products/${p.id}/similar`);
      setSimilarResults(await res.json());
    } finally {
      setSearching(false);
    }
  }

  const uploadProps: UploadProps = {
    showUploadList: false,
    accept: "image/*",
    customRequest: async ({ file, onSuccess, onError }) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("image", file as File);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) throw new Error(await res.text());
        const result = await res.json();
        message.success(
          `업로드 완료: ${result.name} / ${result.tags.map((t: { value: string }) => t.value).join(", ")}`
        );
        onSuccess?.(result);
        await loadFilters();
        await search();
      } catch (err) {
        message.error("업로드 실패: " + String(err));
        onError?.(err as Error);
      } finally {
        setUploading(false);
      }
    },
  };

  return (
    <div>
      <Paragraph type="secondary">
        이미지를 업로드하면 AI가 색상/카테고리/스타일을 자동으로 태깅해서 DB에 저장합니다.
        여기서 등록한 스타일을 오더에 연결해서 씁니다.
      </Paragraph>

      <Space style={{ marginBottom: 16 }}>
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} loading={uploading}>
            이미지 업로드
          </Button>
        </Upload>
      </Space>

      <Space wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder="브랜드 전체"
          allowClear
          style={{ width: 140 }}
          value={query.brand}
          onChange={(v) => setQuery((q) => ({ ...q, brand: v }))}
          options={filters.brands.map((b) => ({ value: b, label: b }))}
        />
        <Select
          placeholder="색상 전체"
          allowClear
          style={{ width: 140 }}
          value={query.color}
          onChange={(v) => setQuery((q) => ({ ...q, color: v }))}
          options={filters.color.map((c) => ({ value: c, label: c }))}
        />
        <Select
          placeholder="카테고리 전체"
          allowClear
          style={{ width: 140 }}
          value={query.category}
          onChange={(v) => setQuery((q) => ({ ...q, category: v }))}
          options={filters.category.map((c) => ({ value: c, label: c }))}
        />
        <Select
          placeholder="스타일 전체"
          allowClear
          style={{ width: 140 }}
          value={query.style}
          onChange={(v) => setQuery((q) => ({ ...q, style: v }))}
          options={filters.style.map((s) => ({ value: s, label: s }))}
        />
        <Button type="primary" onClick={() => search()}>검색</Button>
      </Space>

      <Space.Compact style={{ width: "100%", maxWidth: 480, marginBottom: 20 }}>
        <Input
          placeholder="예: 레드 캐주얼 상의"
          value={textQuery}
          onChange={(e) => setTextQuery(e.target.value)}
          onPressEnter={searchByText}
        />
        <Button icon={<SearchOutlined />} onClick={searchByText} loading={searching}>
          문장으로 유사 스타일 찾기
        </Button>
      </Space.Compact>

      {showingSimilar ? (
        <div>
          <Space style={{ marginBottom: 12, justifyContent: "space-between", width: "100%" }}>
            <Button icon={<ArrowLeftOutlined />} onClick={closeSimilar}>
              전체 상품으로 돌아가기
            </Button>
            <Text strong>
              {similarOf ? `"${similarOf.name}"와 비슷한 상품` : `"${textQuery}" 검색 결과`}
            </Text>
          </Space>
          {searching ? <Spin /> : <ProductGrid products={similarResults} onSimilar={showSimilar} />}
        </div>
      ) : (
        <ProductGrid products={products} onSimilar={showSimilar} />
      )}
    </div>
  );
}

function ProductGrid({ products, onSimilar }: { products: Product[]; onSimilar: (p: Product) => void }) {
  if (products.length === 0) {
    return <Empty description="검색 결과가 없습니다." />;
  }
  return (
    <Row gutter={[16, 16]}>
      {products.map((p) => (
        <Col key={p.id} xs={12} sm={8} md={6} lg={4}>
          <Card
            hoverable
            cover={<img src={`/uploads/${p.image_path}`} alt={p.name} style={{ height: 160, objectFit: "cover" }} />}
            actions={[
              <a key="similar" onClick={() => onSimilar(p)}>비슷한 상품</a>,
            ]}
          >
            <Meta
              title={p.name}
              description={
                <>
                  {p.brand && <Text type="secondary" style={{ fontSize: 12 }}>{p.brand}</Text>}
                  <div style={{ marginTop: 6 }}>
                    {p.tags.map((t) => (
                      <Tag key={t.value} style={{ marginBottom: 4 }}>{t.value}</Tag>
                    ))}
                  </div>
                </>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
