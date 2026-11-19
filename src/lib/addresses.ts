import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongo";
import { User, isId, type UserDoc } from "@/lib/models";
import { HttpError } from "@/lib/auth/session";
import { MAX_ADDRESSES } from "@/lib/constants";
import { addressInput, type Address } from "@/lib/address-schema";

type RawAddress = NonNullable<UserDoc["addresses"]>[number] & { _id: Types.ObjectId };

export const addressDTO = (a: RawAddress): Address => ({
  id: String(a._id), label: (a.label ?? "Home") as Address["label"], recipientName: a.recipientName, phone: a.phone,
  street: a.street, city: a.city, state: a.state, pincode: a.pincode, isDefault: !!a.isDefault,
});

/** Default first, then in the order they were added. */
export async function listAddresses(userId: string): Promise<Address[]> {
  await connectDB();
  const u = await User.findById(userId).select("addresses").lean<UserDoc>();
  const list = ((u?.addresses ?? []) as RawAddress[]).map(addressDTO);
  return [...list.filter((a) => a.isDefault), ...list.filter((a) => !a.isDefault)];
}

export async function findAddress(userId: string, addressId: string) {
  return (await listAddresses(userId)).find((a) => a.id === addressId) ?? null;
}

/**
 * Make `addressId` the only default — or, with no id, make sure there is exactly one default
 * (the existing one, else the first address). A single pipeline update, so it's atomic.
 */
async function normalizeDefault(userId: string, addressId?: string) {
  const target = addressId
    ? new Types.ObjectId(addressId)
    : {
        $let: {
          vars: { d: { $filter: { input: "$addresses", cond: "$$this.isDefault" } } },
          in: { $ifNull: [{ $arrayElemAt: ["$$d._id", 0] }, { $arrayElemAt: ["$addresses._id", 0] }] },
        },
      };
  await User.updateOne({ _id: userId }, [
    { $set: { _target: target } },
    { $set: { addresses: { $map: { input: "$addresses", in: { $mergeObjects: ["$$this", { isDefault: { $eq: ["$$this._id", "$_target"] } }] } } } } },
    { $unset: "_target" },
  ]);
}

export async function addAddress(userId: string, raw: unknown) {
  const a = addressInput.parse(raw);
  await connectDB();
  const _id = new Types.ObjectId();
  // Capacity check and push in one conditional update.
  const r = await User.updateOne(
    { _id: userId, [`addresses.${MAX_ADDRESSES - 1}`]: { $exists: false } },
    { $push: { addresses: { _id, label: a.label, recipientName: a.recipientName, phone: a.phone, street: a.street, city: a.city, state: a.state, pincode: a.pincode, isDefault: false } } },
  );
  if (!r.modifiedCount) throw new HttpError(400, `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.`);
  await normalizeDefault(userId, a.isDefault ? String(_id) : undefined); // first address becomes default automatically
  return { id: String(_id), addresses: await listAddresses(userId) };
}

export async function updateAddress(userId: string, addressId: string, raw: unknown) {
  if (!isId(addressId)) throw new HttpError(404, "Address not found.");
  const a = addressInput.parse(raw);
  await connectDB();
  const r = await User.updateOne(
    { _id: userId, "addresses._id": addressId },
    { $set: { "addresses.$.label": a.label, "addresses.$.recipientName": a.recipientName, "addresses.$.phone": a.phone, "addresses.$.street": a.street, "addresses.$.city": a.city, "addresses.$.state": a.state, "addresses.$.pincode": a.pincode } },
  );
  if (!r.matchedCount) throw new HttpError(404, "Address not found.");
  if (a.isDefault) await normalizeDefault(userId, addressId);
  return listAddresses(userId);
}

export async function setDefaultAddress(userId: string, addressId: string) {
  if (!isId(addressId)) throw new HttpError(404, "Address not found.");
  await connectDB();
  if (!(await User.exists({ _id: userId, "addresses._id": addressId }))) throw new HttpError(404, "Address not found.");
  await normalizeDefault(userId, addressId);
  return listAddresses(userId);
}

export async function deleteAddress(userId: string, addressId: string) {
  if (!isId(addressId)) throw new HttpError(404, "Address not found.");
  await connectDB();
  const r = await User.updateOne({ _id: userId }, { $pull: { addresses: { _id: addressId } } });
  if (!r.modifiedCount) throw new HttpError(404, "Address not found.");
  await normalizeDefault(userId); // deleting the default promotes the next one
  return listAddresses(userId);
}
