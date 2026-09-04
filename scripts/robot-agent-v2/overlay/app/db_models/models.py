from blockly_server.extensions import db


class Projects(db.Model):
    project_id = db.Column("project_id", db.Integer, primary_key=True)
    title = db.Column(db.String(100))
    info = db.Column(db.String(500))

    def __init__(self, title, info):
        self.title = title
        self.info = info

    def to_dict(self):
        return {
            "project_id": self.project_id,
            "title": self.title,
            "info": self.info,
        }
