class Progress {
  constructor(models) {
    this.models = models;
  }
  async compute(spec) {
    const { StatusCounter, Status } = this.models;
    const [{ count }, { total }] = await Promise.all([StatusCounter, Status].map(m => m.findOne(spec)));

    const progress = (count / total) * 100;
    return progress;
  }
}

module.exports = Progress;
