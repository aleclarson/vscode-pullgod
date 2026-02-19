import * as assert from "assert";
import { timeAgo } from "../timeAgo";

suite("timeAgo", () => {
  test("should return 'just now' for less than 10 seconds", () => {
    const now = new Date();
    assert.strictEqual(timeAgo(now), "just now");

    const fiveSecondsAgo = new Date(now.getTime() - 5000);
    assert.strictEqual(timeAgo(fiveSecondsAgo), "just now");
  });

  test("should return 'seconds ago' for 10-59 seconds", () => {
    const now = new Date();
    const tenSecondsAgo = new Date(now.getTime() - 10000);
    assert.strictEqual(timeAgo(tenSecondsAgo), "10 seconds ago");

    const fiftyNineSecondsAgo = new Date(now.getTime() - 59000);
    assert.strictEqual(timeAgo(fiftyNineSecondsAgo), "59 seconds ago");
  });

  test("should return 'minute ago' for 1 minute", () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    assert.strictEqual(timeAgo(oneMinuteAgo), "1 minute ago");
  });

  test("should return 'minutes ago' for multiple minutes", () => {
    const now = new Date();
    const twoMinutesAgo = new Date(now.getTime() - 120000);
    assert.strictEqual(timeAgo(twoMinutesAgo), "2 minutes ago");

    const fiftyNineMinutesAgo = new Date(now.getTime() - 3540000);
    assert.strictEqual(timeAgo(fiftyNineMinutesAgo), "59 minutes ago");
  });

  test("should return 'hour ago' for 1 hour", () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    assert.strictEqual(timeAgo(oneHourAgo), "1 hour ago");
  });

  test("should return 'hours ago' for multiple hours", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 7200000);
    assert.strictEqual(timeAgo(twoHoursAgo), "2 hours ago");
  });

  test("should return 'day ago' for 1 day", () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 86400000);
    assert.strictEqual(timeAgo(oneDayAgo), "1 day ago");
  });

  test("should return 'days ago' for multiple days", () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 172800000);
    assert.strictEqual(timeAgo(twoDaysAgo), "2 days ago");
  });

  test("should return 'month ago' for 1 month", () => {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 2592000000); // 30 days
    assert.strictEqual(timeAgo(oneMonthAgo), "1 month ago");
  });

  test("should return 'year ago' for 1 year", () => {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 31536000000); // 365 days
    assert.strictEqual(timeAgo(oneYearAgo), "1 year ago");
  });
});
