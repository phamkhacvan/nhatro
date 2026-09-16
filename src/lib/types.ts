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
  cccd?: string | null;
  gender?: string | null;
  birth_year?: string | null;
  occupation?: string | null;
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
  exempt_elec?: boolean;
  exempt_wifi?: boolean;
  exempt_water?: boolean;
  exempt_penalty?: boolean;
  exempt_from?: string | null;
  exempt_until?: string | null;
  room_price?: number | null;
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

export type GuestNight = {
  date: string;
  name: string;
  relation: string;
};

export type GuestMode = "chung" | "rieng";

export type MonthlyRow = {
  id?: number;
  house_id?: number;
  ky: string;
  room: string;
  tenant: string;
  phone: string;
  cccd?: string | null;
  gender?: string | null;
  birth_year?: string | null;
  occupation?: string | null;
  occupancy: number;
  old_index: number | null;
  old_date: string | null;
  new_index: number | null;
  close_date: string | null;
  move_in: string | null;
  move_out: string | null;
  nights: number;
  violations: number;
  guest: number;
  paid: number;
  guest_dates?: GuestNight[] | null;
  guest_mode?: GuestMode | string | null;
  washing_machine?: boolean;
  // Trạng thái miễn phí theo thành phần (sync từ nhatro_rooms qua applyRoomSync)
  exempt_elec?: boolean;
  exempt_wifi?: boolean;
  exempt_water?: boolean;
  exempt_penalty?: boolean;
  exempt_from?: string | null;
  exempt_until?: string | null;
  room_price?: number | null;
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
  exempted: ("water" | "wifi" | "elec" | "penalty")[];
  total: number;
  remain: number;
  prevOcc: number;
  prevOldIndex: number;
  prevNewIndex: number;
  prevKwh: number;
  prevNights: number;
  prevGuestDates: GuestNight[];
  prevGuestMode: GuestMode;
  prevGuestPeople: number;
  prevViolations: number;
  prevCloseDate: string | null;
  prevMoveIn: string | null;
  prevUtilNote: string;
  prevUtilGuest: boolean;
};