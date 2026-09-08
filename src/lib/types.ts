export type House = {
  id: number;
  name: string;
  address: string;
  due_text: string;
  transfer_note: string;
  note: string;
  elec_rate: number;
  water_rate: number;
  wifi_rate: number;
  max_occupancy: number;
  cur_ky: string;
  bank_code: string | null;
  bank_account: string | null;
  bank_name: string | null;
  created_at?: string;
};

export type Settings = {
  id: number;
  active_house_id: number;
};

export type PriceRow = {
  house_id?: number;
  occupancy: number;
  price: number;
};

export type Room = {
  house_id?: number;
  room: string;
  tenant: string;
  phone: string;
  email: string | null;
  occupancy: number;
  move_in: string | null;
  contract_end: string | null;
  tam_tru_date: string | null;
  deposit: number;
  deposit_date: string | null;
  active: boolean;
  initial_index?: number | null;
  washing_machine: boolean;
};

export type ContractMeta = {
  file_name: string;
  mime: string;
  size: number;
};

export type ContractRow = {
  id?: number;
  house_id: number;
  room: string;
  file_name: string;
  mime: string;
  size: number;
  data: string;
  created_at?: string;
};

export type MonthlyRow = {
  id?: number;
  house_id?: number;
  ky: string;
  room: string;
  tenant: string;
  phone: string;
  occupancy: number;
  old_index: number | null;
  new_index: number | null;
  close_date: string | null;
  move_in: string | null;
  move_out: string | null;
  nights: number;
  violations: number;
  guest: number;
  paid: number;
  washing_machine?: boolean;
};

export type ComputedRow = MonthlyRow & {
  kwh: number | null;
  rent: number;
  rentNote: string;
  water: number;
  wifi: number;
  elec: number;
  penalty: number;
  guestFee: number;
  hasGuest: boolean;
  total: number;
  remain: number;
  prevOcc: number;
  prevOldIndex: number;
  prevNewIndex: number;
  prevKwh: number;
  prevNights: number;
  prevViolations: number;
  prevCloseDate: string | null;
  prevMoveIn: string | null;
  prevUtilNote: string;
  prevUtilGuest: boolean;
};