import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  StorageKeys,
  clearProfileData,
  getActiveProfileId,
  readCollection,
  readGlobalValue,
  readValue,
  setActiveProfileId,
  writeCollection,
  writeGlobalValue,
  writeValue,
} from "@/lib/storage";

beforeEach(async () => {
  await AsyncStorage.clear();
  setActiveProfileId(null);
});

describe("lib/storage.ts profile scoping", () => {
  it("with no active profile, reads/writes use the plain (legacy) key", async () => {
    await writeValue(StorageKeys.settings, { foo: "bar" });
    const raw = await AsyncStorage.getItem(StorageKeys.settings);
    expect(raw).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("once a profile is active, the same call is transparently namespaced under that profile", async () => {
    setActiveProfileId("profile-a");
    await writeValue(StorageKeys.settings, { foo: "bar" });

    const rawUnscoped = await AsyncStorage.getItem(StorageKeys.settings);
    expect(rawUnscoped).toBeNull();

    const rawScoped = await AsyncStorage.getItem("wealthos:profile:profile-a:settings");
    expect(rawScoped).toBe(JSON.stringify({ foo: "bar" }));

    const value = await readValue<{ foo: string }>(StorageKeys.settings);
    expect(value).toEqual({ foo: "bar" });
  });

  it("getActiveProfileId reflects the last setActiveProfileId call", () => {
    expect(getActiveProfileId()).toBeNull();
    setActiveProfileId("abc");
    expect(getActiveProfileId()).toBe("abc");
    setActiveProfileId(null);
    expect(getActiveProfileId()).toBeNull();
  });

  it("two different active profiles never see each other's collections — core Phase 6/7 isolation guarantee", async () => {
    setActiveProfileId("richard");
    await writeCollection(StorageKeys.accounts, [{ id: "1", name: "Richard's account" }]);

    setActiveProfileId("testgebruiker");
    const testUserAccounts = await readCollection<{ id: string; name: string }>(StorageKeys.accounts);
    expect(testUserAccounts).toEqual([]);

    await writeCollection(StorageKeys.accounts, [{ id: "2", name: "Testgebruiker's account" }]);

    setActiveProfileId("richard");
    const richardAccounts = await readCollection<{ id: string; name: string }>(StorageKeys.accounts);
    expect(richardAccounts).toEqual([{ id: "1", name: "Richard's account" }]);
  });

  it("readGlobalValue/writeGlobalValue bypass profile scoping entirely (needed for the profile registry itself)", async () => {
    setActiveProfileId("some-profile");
    await writeGlobalValue("profiles", [{ id: "x" }]);

    const rawGlobal = await AsyncStorage.getItem("wealthos:profiles");
    expect(rawGlobal).toBe(JSON.stringify([{ id: "x" }]));

    setActiveProfileId(null);
    const value = await readGlobalValue<{ id: string }[]>("profiles");
    expect(value).toEqual([{ id: "x" }]);
  });

  it("clearProfileData removes only that profile's keys, leaving other profiles and global data untouched", async () => {
    setActiveProfileId("richard");
    await writeCollection(StorageKeys.accounts, [{ id: "1" }]);
    await writeValue(StorageKeys.settings, { theme: "dark" });

    setActiveProfileId("testgebruiker");
    await writeCollection(StorageKeys.accounts, [{ id: "2" }]);

    setActiveProfileId(null);
    await writeGlobalValue("profiles", [{ id: "richard" }, { id: "testgebruiker" }]);

    await clearProfileData("richard");

    expect(await AsyncStorage.getItem("wealthos:profile:richard:accounts")).toBeNull();
    expect(await AsyncStorage.getItem("wealthos:profile:richard:settings")).toBeNull();

    setActiveProfileId("testgebruiker");
    const testUserAccounts = await readCollection<{ id: string }>(StorageKeys.accounts);
    expect(testUserAccounts).toEqual([{ id: "2" }]);

    setActiveProfileId(null);
    const profiles = await readGlobalValue<{ id: string }[]>("profiles");
    expect(profiles).toEqual([{ id: "richard" }, { id: "testgebruiker" }]);
  });
});
