// Click & Drop API Types based on official Royal Mail API v1 specification

// Package format identifiers
export type PackageFormat =
  | 'letter'
  | 'largeLetter'
  | 'smallParcel'
  | 'mediumParcel'
  | 'largeParcel'
  | 'parcel'
  | 'documents';

// Notification recipient options
export type NotificationRecipient = 'sender' | 'recipient' | 'billing';

// Address Request
export interface AddressRequest {
  fullName?: string; // max 210
  companyName?: string; // max 100
  addressLine1: string; // max 100, required
  addressLine2?: string; // max 100
  addressLine3?: string; // max 100
  city: string; // max 100, required
  county?: string; // max 100
  postcode?: string; // max 20
  countryCode: string; // max 3, required
}

// Recipient Details Request
export interface RecipientDetailsRequest {
  address: AddressRequest;
  phoneNumber?: string; // max 25
  emailAddress?: string; // max 254
  addressBookReference?: string; // max 100
}

// Sender Details Request
export interface SenderDetailsRequest {
  tradingName?: string; // max 250
  phoneNumber?: string; // max 25
  emailAddress?: string; // max 254
}

// Billing Details Request
export interface BillingDetailsRequest {
  address?: AddressRequest;
  phoneNumber?: string; // max 25
  emailAddress?: string; // max 254
}

// Dimensions Request
export interface DimensionsRequest {
  heightInMms: number; // required, integer format
  widthInMms: number; // required, integer format  
  depthInMms: number; // required, integer format
}

// Product Item Request
export interface ProductItemRequest {
  name?: string; // max 800
  SKU?: string; // max 100
  quantity: number; // 1-999999, required
  unitValue?: number; // 0-999999, decimal
  unitWeightInGrams?: number; // 0-999999
  customsDescription?: string; // max 50
  extendedCustomsDescription?: string; // max 300
  customsCode?: string; // max 10
  originCountryCode?: string; // max 3
  customsDeclarationCategory?:
    | 'none'
    | 'gift'
    | 'commercialSample'
    | 'documents'
    | 'other'
    | 'returnedGoods'
    | 'saleOfGoods'
    | 'mixedContent';
}

// Shipment Package Request
export interface ShipmentPackageRequest {
  weightInGrams: number; // 1-30000, required
  packageFormatIdentifier: PackageFormat; // required
  dimensions?: DimensionsRequest;
  contents?: ProductItemRequest[];
}

// Postage Details Request
export interface PostageDetailsRequest {
  sendNotificationsTo?: NotificationRecipient;
  serviceCode?: string; // max 10, account-specific
  carrierName?: string; // max 50
  serviceRegisterCode?: string; // max 2
  consequentialLoss?: number; // 0-10000
  receiveEmailNotification?: boolean;
  receiveSmsNotification?: boolean;
  requestSignatureUponDelivery?: boolean;
  isLocalCollect?: boolean;
  safePlace?: string; // max 90
  department?: string; // max 150
  AIRNumber?: string; // max 50
  IOSSNumber?: string; // max 50
  requiresExportLicense?: boolean;
  commercialInvoiceNumber?: string; // max 35
  commercialInvoiceDate?: string; // ISO date-time
  recipientEoriNumber?: string;
}

// Label Generation Request (OBA only)
export interface LabelGenerationRequest {
  includeLabelInResponse: boolean; // required
  includeCN?: boolean;
  includeReturnsLabel?: boolean;
}

// Tag Request
export interface TagRequest {
  key: string; // max 100
  value: string; // max 100
}

// Create Order Request
export interface CreateOrderRequest {
  orderReference?: string; // max 40
  isRecipientABusiness?: boolean;
  recipient: RecipientDetailsRequest; // required
  sender?: SenderDetailsRequest;
  billing?: BillingDetailsRequest;
  packages?: ShipmentPackageRequest[];
  orderDate: string; // ISO date-time, required
  plannedDespatchDate?: string; // ISO date-time
  specialInstructions?: string; // max 500
  subtotal: number; // 0-999999, decimal, required
  shippingCostCharged: number; // 0-999999, decimal, required
  otherCosts?: number; // 0-999999, decimal
  customsDutyCosts?: number; // 0-99999.99, decimal
  total: number; // 0-999999, decimal, required
  currencyCode?: string; // max 3
  postageDetails?: PostageDetailsRequest;
  tags?: TagRequest[];
  label?: LabelGenerationRequest;
  orderTax?: number; // 0-999999, decimal
  containsDangerousGoods?: boolean;
  dangerousGoodsUnCode?: string; // max 4
  dangerousGoodsDescription?: string; // max 500
  dangerousGoodsQuantity?: number;
}

// Create Orders Request (batch)
export interface CreateOrdersRequest {
  items: CreateOrderRequest[]; // required, min 1
}

// Create Package Response
export interface CreatePackagesResponse {
  packageNumber: number;
  trackingNumber: string;
}

// Create Order Response
export interface CreateOrderResponse {
  orderIdentifier: number; // required
  orderReference?: string;
  createdOn: string; // ISO date-time, required
  orderDate?: string; // ISO date-time
  printedOn?: string; // ISO date-time
  manifestedOn?: string; // ISO date-time
  shippedOn?: string; // ISO date-time
  trackingNumber?: string;
  packages?: CreatePackagesResponse[];
  label?: string; // base64 PDF string
  labelErrors?: CreateOrderLabelErrorResponse[];
  generatedDocuments?: string[];
}

// Create Order Label Error Response
export interface CreateOrderLabelErrorResponse {
  message: string;
  code: string;
}

// Create Order Error Response
export interface CreateOrderErrorResponse {
  errorCode: number;
  errorMessage: string;
  fields?: OrderFieldResponse[];
}

// Order Field Response
export interface OrderFieldResponse {
  fieldName: string;
  value: string;
}

// Failed Order Response
export interface FailedOrderResponse {
  order: CreateOrderRequest;
  errors: CreateOrderErrorResponse[];
}

// Create Orders Response (batch response)
export interface CreateOrdersResponse {
  successCount: number;
  errorsCount: number;
  createdOrders: CreateOrderResponse[];
  failedOrders: FailedOrderResponse[];
}

// Get Order Info Resource
export interface GetOrderInfoResource {
  orderIdentifier: number; // required
  orderReference?: string;
  createdOn: string; // ISO date-time, required
  orderDate?: string; // ISO date-time
  printedOn?: string; // ISO date-time
  manifestedOn?: string; // ISO date-time
  shippedOn?: string; // ISO date-time
  trackingNumber?: string;
  packages?: CreatePackagesResponse[];
}

// Update Order Status Request
export interface UpdateOrderStatusRequest {
  orderIdentifier?: number;
  orderReference?: string;
  status: 'new' | 'despatchedByOtherCourier' | 'despatched';
  trackingNumber?: string;
  despatchDate?: string; // ISO date-time
  shippingCarrier?: string;
  shippingService?: string;
}

// Update Orders Status Request
export interface UpdateOrdersStatusRequest {
  items: UpdateOrderStatusRequest[]; // min 1, max 100
}

// Updated Order Info
export interface UpdatedOrderInfo {
  orderIdentifier: number;
  orderReference?: string;
  status: string;
}

// Order Update Error
export interface OrderUpdateError {
  orderIdentifier?: number;
  orderReference?: string;
  status?: string;
  code: string;
  message: string;
}

// Update Order Status Response
export interface UpdateOrderStatusResponse {
  updatedOrders: UpdatedOrderInfo[];
  errors: OrderUpdateError[];
}

// Delete Order Info
export interface DeletedOrderInfo {
  orderIdentifier: number;
  orderReference?: string;
  orderInfo?: string;
}

// Order Error Info
export interface OrderErrorInfo {
  orderIdentifier?: number;
  orderReference?: string;
  code: string;
  message: string;
}

// Delete Orders Response
export interface DeleteOrdersResource {
  deletedOrders: DeletedOrderInfo[];
  errors: OrderErrorInfo[];
}

// Error Response
export interface ErrorResponse {
  code?: string;
  message: string;
  details?: string;
}

// Order Error Response
export interface OrderErrorResponse {
  accountOrderNumber?: number;
  channelOrderReference?: string;
  code: string;
  message: string;
}

