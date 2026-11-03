export interface CustomerForm {
  name: string;
  email: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
}

export const EMPTY_CUSTOMER: CustomerForm = {
  name: '',
  email: '',
  phone: '',
  cep: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
};

export type CustomerErrors = Partial<Record<keyof CustomerForm, string>>;

export function validateCustomer(form: CustomerForm, needsAddress: boolean): CustomerErrors {
  const errors: CustomerErrors = {};
  const digits = (value: string) => value.replace(/\D/g, '');

  if (form.name.trim().length < 3 || !form.name.trim().includes(' ')) errors.name = 'Informe o nome completo.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) errors.email = 'Informe um e-mail válido.';
  if (digits(form.phone).length < 10) errors.phone = 'Informe um telefone com DDD.';
  if (!needsAddress) return errors;
  if (digits(form.cep).length !== 8) errors.cep = 'O CEP deve ter 8 números.';
  if (form.street.trim().length < 2) errors.street = 'Informe a rua.';
  if (form.number.trim().length < 1) errors.number = 'Informe o número.';
  if (form.neighborhood.trim().length < 2) errors.neighborhood = 'Informe o bairro.';
  if (form.city.trim().length < 2) errors.city = 'Informe a cidade.';
  if (!/^[A-Za-z]{2}$/.test(form.state.trim())) errors.state = 'Use a sigla do estado (ex.: SP).';

  return errors;
}

export function toRpcCustomer(form: CustomerForm) {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone,
    cep: form.cep,
    street: form.street.trim(),
    number: form.number.trim(),
    complement: form.complement.trim(),
    neighborhood: form.neighborhood.trim(),
    city: form.city.trim(),
    state: form.state.trim().toUpperCase(),
  };
}
