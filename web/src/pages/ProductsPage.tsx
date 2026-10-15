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
  Modal,
  Form,
  AutoComplete,
} from "antd";
import { UploadOutlined, SearchOutlined, ArrowLeftOutlined, EditOutlined } from "@ant-design/icons";
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
  const [editing, setEditing] = useState<Product | null>(null);

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

  function handleTextChange(value: string) {
    setTextQuery(value);
    // 검색창을 비우면 바로 전체 목록으로 돌아감 (뒤로가기 버튼 안 눌러도 됨)
    if (!value.trim() && similarOf === null) {
      closeSimilar();
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

  async function refreshAll() {
    await loadFilters();
    await search();
    if (showingSimilar && similarOf) await showSimilar(similarOf);
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
        await refreshAll();
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
        AI가 브랜드나 태그를 잘못 잡으면 카드의 수정 버튼으로 바로 고칠 수 있어요.
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
          placeholder="예: 레드 캐주얼 상의 (지우면 전체 목록으로 돌아감)"
          value={textQuery}
          onChange={(e) => handleTextChange(e.target.value)}
          onPressEnter={searchByText}
          allowClear
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
          {searching ? <Spin /> : <ProductGrid products={similarResults} onSimilar={showSimilar} onEdit={setEditing} />}
        </div>
      ) : (
        <ProductGrid products={products} onSimilar={showSimilar} onEdit={setEditing} />
      )}

      <EditProductModal
        product={editing}
        brands={filters.brands}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await refreshAll();
        }}
      />
    </div>
  );
}

function ProductGrid({
  products,
  onSimilar,
  onEdit,
}: {
  products: Product[];
  onSimilar: (p: Product) => void;
  onEdit: (p: Product) => void;
}) {
  if (products.length === 0) {
    return <Empty description="검색 결과가 없습니다." />;
  }
  return (
    <Row gutter={[16, 16]} align="stretch">
      {products.map((p) => (
        <Col key={p.id} xs={12} sm={8} md={6} lg={4} style={{ display: "flex" }}>
          <Card
            hoverable
            style={{ display: "flex", flexDirection: "column", width: "100%" }}
            styles={{ body: { flex: 1, display: "flex", flexDirection: "column" } }}
            cover={<img src={`/uploads/${p.image_path}`} alt={p.name} style={{ height: 160, objectFit: "cover" }} />}
            actions={[
              <a key="similar" onClick={() => onSimilar(p)}>비슷한 상품</a>,
              <a key="edit" onClick={() => onEdit(p)}><EditOutlined /> 수정</a>,
            ]}
          >
            <Meta
              title={<div style={{ height: 44, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</div>}
              description={
                <div style={{ minHeight: 70 }}>
                  {p.brand && <Text type="secondary" style={{ fontSize: 12 }}>{p.brand}</Text>}
                  <div style={{ marginTop: 6 }}>
                    {p.tags.map((t) => (
                      <Tag key={t.value} style={{ marginBottom: 4 }}>{t.value}</Tag>
                    ))}
                  </div>
                </div>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function EditProductModal({
  product,
  brands,
  onClose,
  onSaved,
}: {
  product: Product | null;
  brands: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (product) {
      form.setFieldsValue({
        name: product.name,
        brand: product.brand ?? undefined,
        color: product.tags.find((t) => t.type === "color")?.value,
        category: product.tags.find((t) => t.type === "category")?.value,
        style: product.tags.find((t) => t.type === "style")?.value,
      });
    }
  }, [product, form]);

  async function handleSave(values: { name: string; brand?: string; color?: string; category?: string; style?: string }) {
    if (!product) return;
    const tags = [
      values.color && { type: "color", value: values.color },
      values.category && { type: "category", value: values.category },
      values.style && { type: "style", value: values.style },
    ].filter(Boolean);

    await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: values.name, brand: values.brand ?? null, tags }),
    });
    message.success("수정되었습니다.");
    onSaved();
  }

  return (
    <Modal title="상품 정보 수정" open={!!product} onCancel={onClose} footer={null} destroyOnClose>
      <Form form={form} layout="vertical" onFinish={handleSave}>
        <Form.Item name="name" label="상품명" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="brand" label="브랜드">
          <AutoComplete
            allowClear
            placeholder="브랜드 선택 또는 직접 입력"
            options={brands.map((b) => ({ value: b }))}
            filterOption={(input, option) =>
              (option?.value ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="color" label="색상">
          <Input />
        </Form.Item>
        <Form.Item name="category" label="카테고리">
          <Input />
        </Form.Item>
        <Form.Item name="style" label="스타일">
          <Input />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>저장</Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}
