actor {
  stable var downloadCount : Nat = 0;

  public func incrementDownloadCount() : async Nat {
    downloadCount += 1;
    return downloadCount;
  };

  public query func getDownloadCount() : async Nat {
    return downloadCount;
  };
};
