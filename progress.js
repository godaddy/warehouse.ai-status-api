class Progress {
  constructor(models) {
    this.models = models;
  }
  async compute(spec) {
    const { StatusCounter, Status } = this.models;
    const [statusCount, status] = await Promise.all([StatusCounter, Status].map(m => m.findOne(spec)));
    let { count } = statusCount || {};
    let { total } = status || {};

    count = count || 0;
    total = total || 0;

    const progress = total !== 0 ? (count / total) * 100 : 0;
    return { progress, count, total };
  }
}

module.exports = Progress;
