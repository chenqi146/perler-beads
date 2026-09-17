import type { Metadata } from 'next';
import RegisterForm from './RegisterForm';

export const metadata: Metadata = {
  title: '注册',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
