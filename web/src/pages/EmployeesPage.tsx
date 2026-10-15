import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, DatePicker, Typography, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Employee } from "../types";

const { Text } = Typography;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/employees");
      setEmployees(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addEmployee(values: {
    name: string;
    department: string;
    position?: string;
    hire_date?: dayjs.Dayjs;
  }) {
    await fetch("/api/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...values,
        hire_date: values.hire_date ? values.hire_date.format("YYYY-MM-DD") : null,
      }),
    });
    message.success("직원이 등록되었습니다.");
    form.resetFields();
    setModalOpen(false);
    await load();
  }

  const columns = [
    { title: "이름", dataIndex: "name", key: "name" },
    { title: "부서", dataIndex: "department", key: "department" },
    {
      title: "직책",
      dataIndex: "position",
      key: "position",
      render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
    },
    {
      title: "입사일",
      dataIndex: "hire_date",
      key: "hire_date",
      render: (v: string | null) => v ?? <Text type="secondary">-</Text>,
    },
  ];

  return (
    <div>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)} style={{ marginBottom: 16 }}>
        직원 등록
      </Button>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={employees}
        pagination={{ pageSize: 10 }}
      />

      <Modal title="직원 등록" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={addEmployee}>
          <Form.Item name="name" label="이름" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="department" label="부서" rules={[{ required: true }]}>
            <Input placeholder="오더 / 생산 / 선적 / 회계 / 인사" />
          </Form.Item>
          <Form.Item name="position" label="직책">
            <Input />
          </Form.Item>
          <Form.Item name="hire_date" label="입사일">
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              등록
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
